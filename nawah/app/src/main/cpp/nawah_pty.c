/*
 * A pseudo-terminal, so that a USB device becomes a real serial port.
 *
 * The alternative was a socket plus `socat` inside the container, and it is
 * worse in three ways: another package to install, another hop to lose bytes
 * in, and — decisively — no way to learn the baud rate. An application inside
 * the container sets the line speed with tcsetattr() on the slave, and on Linux
 * the master sees that same termios. Holding the master means `stty 115200`,
 * `screen /dev/ttyUSB0 115200` and arduino-cli all just work, with the app
 * quietly following.
 *
 * What a pty cannot carry is the modem control lines. drivers/tty/pty.c defines
 * no .tiocmget or .tiocmset for Unix98 ptys, so TIOCMSET returns -ENOTTY and
 * DTR/RTS never reach the device. That is checked, not assumed, and it is why
 * `nawah-usb reset` exists.
 */
#include <jni.h>
#include <fcntl.h>
#include <stdlib.h>
#include <string.h>
#include <termios.h>
#include <unistd.h>

/* Opens a pty master. Returns the fd, or -errno. */
JNIEXPORT jint JNICALL
Java_io_nawah_linux_usb_SerialPty_nativeOpen(JNIEnv *env, jclass clazz) {
    (void) env; (void) clazz;
    int master = posix_openpt(O_RDWR | O_NOCTTY);
    if (master < 0) return -1;
    if (grantpt(master) != 0 || unlockpt(master) != 0) {
        close(master);
        return -2;
    }

    /*
     * Raw, and raw on purpose. A fresh pty comes up with a line discipline that
     * echoes, translates newlines and buffers by line — every one of which
     * corrupts a binary firmware upload. Setting it here, before anything is
     * written, means a device is never briefly cooked.
     */
    struct termios t;
    if (tcgetattr(master, &t) == 0) {
        cfmakeraw(&t);
        t.c_cc[VMIN] = 1;
        t.c_cc[VTIME] = 0;
        tcsetattr(master, TCSANOW, &t);
    }
    return master;
}

/* The slave's path, e.g. /dev/pts/7. Null on failure. */
JNIEXPORT jstring JNICALL
Java_io_nawah_linux_usb_SerialPty_nativeSlaveName(JNIEnv *env, jclass clazz, jint master) {
    (void) clazz;
    char name[PATH_MAX];
    if (ptsname_r(master, name, sizeof(name)) != 0) return NULL;
    return (*env)->NewStringUTF(env, name);
}

/*
 * The line speed the container has asked for, in bits per second, or 0.
 *
 * This is the whole reason the app holds the master: the number an application
 * inside the container chose is readable from out here.
 */
JNIEXPORT jint JNICALL
Java_io_nawah_linux_usb_SerialPty_nativeBaud(JNIEnv *env, jclass clazz, jint master) {
    (void) env; (void) clazz;
    struct termios t;
    if (tcgetattr(master, &t) != 0) return 0;
    speed_t speed = cfgetospeed(&t);
    switch (speed) {
        case B1200: return 1200;
        case B2400: return 2400;
        case B4800: return 4800;
        case B9600: return 9600;
        case B19200: return 19200;
        case B38400: return 38400;
        case B57600: return 57600;
        case B115200: return 115200;
        case B230400: return 230400;
        case B460800: return 460800;
        case B500000: return 500000;
        case B921600: return 921600;
        case B1000000: return 1000000;
        case B1500000: return 1500000;
        case B2000000: return 2000000;
        default: return 0;
    }
}

/* Data bits, stop bits and parity, packed so one JNI call carries the lot. */
JNIEXPORT jint JNICALL
Java_io_nawah_linux_usb_SerialPty_nativeFraming(JNIEnv *env, jclass clazz, jint master) {
    (void) env; (void) clazz;
    struct termios t;
    if (tcgetattr(master, &t) != 0) return 0;

    int data;
    switch (t.c_cflag & CSIZE) {
        case CS5: data = 5; break;
        case CS6: data = 6; break;
        case CS7: data = 7; break;
        default: data = 8; break;
    }
    int stop = (t.c_cflag & CSTOPB) ? 2 : 1;
    int parity = 0;                                  /* none */
    if (t.c_cflag & PARENB) parity = (t.c_cflag & PARODD) ? 1 : 2;  /* odd : even */

    return (data << 8) | (stop << 4) | parity;
}
