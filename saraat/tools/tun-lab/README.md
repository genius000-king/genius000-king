# TUN lab

Runs the real engine against a real Linux TUN device so you can measure the speed limit with `curl`
(no phone needed). Android gives `VpnService` a TUN file descriptor; this lab gives the engine the same thing.

```
curl --interface 10.1.10.1 ──▶ kernel TCP ──▶ tun0 ──▶ tun_bridge.py ──socket──▶ LabMain (engine) ──▶ lab_servers.py
```

## Run

```bash
pip install pyroute2
sudo python3 tools/tun-lab/tun_bridge.py &           # creates tun0 (10.1.10.1) and routes 203.0.113.0/24 into it
head -c 40000000 /dev/urandom > big.bin
python3 tools/tun-lab/lab_servers.py &               # 127.0.0.1:8080  (GET /big.bin?n=…, POST /upload)

./gradlew :engine:testClasses :engine:printLabClasspath -q | sed -n 's/^LABCP=//p' > /tmp/labcp.txt
tools/tun-lab/run_case.sh 1000 512 1250000 320000   # limits: 1 Mbps down / 512 Kbps up; sizes to transfer
```

Destinations in `203.0.113.0/24` (TEST-NET-3) are redirected to `127.0.0.1`, so nothing leaves the machine.

## Notes

- Don't use `pkill -f <name>` from a shell whose own command line contains that name; the scripts kill by PID.
- The bridge serves one engine connection at a time and cleans up its reader thread on disconnect.
