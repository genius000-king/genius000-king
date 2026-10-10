# Kept on purpose, beyond what the libraries' own consumer rules keep:

# The transfer spec travels through WorkManager as JSON; keep its generated serializers.
-keep,includedescriptorclasses class com.genius.imlaq.models.download.**$$serializer { *; }
-keepclassmembers class com.genius.imlaq.models.download.** {
    *** Companion;
    kotlinx.serialization.KSerializer serializer(...);
}

# Readable stack traces from user reports.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
