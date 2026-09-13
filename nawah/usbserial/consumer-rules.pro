# The drivers are found by reflection through ProbeTable, so R8 cannot see that
# any of them is reachable and will strip the ones the app never names.
-keep class com.hoho.android.usbserial.driver.** { *; }
