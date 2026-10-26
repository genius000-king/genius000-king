# kotlinx.serialization: keep generated serializers of protocol and model classes.
-keepattributes *Annotation*, InnerClasses
-keepclassmembers class com.genius.tvhub.** { *** Companion; }
-keepclasseswithmembers class com.genius.tvhub.** { kotlinx.serialization.KSerializer serializer(...); }
-keep,includedescriptorclasses class com.genius.tvhub.**$$serializer { *; }
# Ktor / Netty-free CIO engine: reflection-light, but keep its service loaders.
-keep class io.ktor.** { *; }
-dontwarn io.ktor.**
-dontwarn org.slf4j.**
-dontwarn java.lang.management.**
# The accessibility service and activities are referenced from the manifest only.
-keep class com.genius.tvhub.engine.input.service.HubAccessibilityService

