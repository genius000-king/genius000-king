# Model classes are serialised by name, so R8 must not rename or drop them.
-keepclassmembers class io.nawah.linux.core.** {
    *** Companion;
}
-keepclasseswithmembers class io.nawah.linux.core.** {
    kotlinx.serialization.KSerializer serializer(...);
}
