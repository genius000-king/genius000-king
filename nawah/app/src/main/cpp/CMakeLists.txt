cmake_minimum_required(VERSION 3.22)
project(nawah_pty C)

# Tiny on purpose. Everything that can be done from Kotlin is done from Kotlin;
# this exists only for the four calls the JDK does not expose — posix_openpt,
# grantpt, unlockpt and tcgetattr on a pty master.
add_library(nawah_pty SHARED nawah_pty.c)
target_compile_options(nawah_pty PRIVATE -Wall -Wextra -Werror -O2)
