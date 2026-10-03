#!/usr/bin/env python3
"""
Creates a real Linux TUN device and bridges its packets to the Saraat engine over a local TCP socket.

Android hands a VpnService a TUN file descriptor; this script is the Linux equivalent, so the very
same engine can be exercised against the real kernel TCP stack (curl, iperf, browsers...) without a phone.

    sudo python3 tun_bridge.py [--port 19000]

Needs root (CAP_NET_ADMIN) and `pip install pyroute2`.
Framing on the socket: 2-byte big-endian length + raw IPv4 packet, in both directions.
"""
import argparse, fcntl, os, select, socket, struct, sys, threading

TUNSETIFF = 0x400454CA
IFF_TUN, IFF_NO_PI = 0x0001, 0x1000   # IFF_NO_PI: no extra header, same as Android's VpnService TUN


def open_tun(name: str) -> int:
    fd = os.open("/dev/net/tun", os.O_RDWR)
    fcntl.ioctl(fd, TUNSETIFF, struct.pack("16sH", name.encode(), IFF_TUN | IFF_NO_PI))
    return fd


def configure(name: str, address: str, routes: list[str]) -> None:
    from pyroute2 import IPRoute
    with IPRoute() as ipr:
        idx = ipr.link_lookup(ifname=name)[0]
        ipr.addr("add", index=idx, address=address, mask=32)
        ipr.link("set", index=idx, state="up", mtu=1500)
        for r in routes:
            ipr.route("add", dst=r, oif=idx)


def recv_exact(sock: socket.socket, n: int) -> bytes:
    buf = bytearray()
    while len(buf) < n:
        chunk = sock.recv(n - len(buf))
        if not chunk:
            raise EOFError
        buf += chunk
    return bytes(buf)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=19000)
    ap.add_argument("--name", default="tun0")
    ap.add_argument("--address", default="10.1.10.1")
    ap.add_argument("--route", action="append", default=["203.0.113.0/24"],
                    help="destinations to send through the tunnel (default: TEST-NET-3)")
    args = ap.parse_args()

    fd = open_tun(args.name)
    configure(args.name, args.address, args.route)
    srv = socket.socket()
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(("127.0.0.1", args.port))
    srv.listen(1)
    print(f"[bridge] {args.name} up as {args.address}, routes={args.route}; waiting on 127.0.0.1:{args.port}", flush=True)

    while True:
        conn, _ = srv.accept()
        conn.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        print("[bridge] engine connected", flush=True)
        stop = threading.Event()

        def tun_to_engine() -> None:
            # Poll with a timeout instead of a bare blocking os.read(): a reader left blocked after the
            # engine disconnects would silently steal (and drop) the next packets meant for the next engine.
            try:
                while not stop.is_set():
                    if not select.select([fd], [], [], 0.1)[0]:
                        continue
                    pkt = os.read(fd, 65535)
                    conn.sendall(struct.pack(">H", len(pkt)) + pkt)
            except OSError:
                stop.set()

        t = threading.Thread(target=tun_to_engine, daemon=True)
        t.start()
        try:
            while True:
                (n,) = struct.unpack(">H", recv_exact(conn, 2))
                os.write(fd, recv_exact(conn, n))
        except (EOFError, OSError):
            pass
        stop.set()
        t.join()          # make sure the old reader is gone before the next engine connects
        conn.close()
        print("[bridge] engine disconnected", flush=True)


if __name__ == "__main__":
    sys.exit(main())
