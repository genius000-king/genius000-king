# ADB mode: the agent is started by name through app_process, never referenced from app code.
-keep class com.genius.tvhub.engine.adb.agent.ShellAgent { *; }
-keep class com.genius.tvhub.engine.adb.agent.AgentProtocol { *; }
-keep class com.genius.tvhub.engine.adb.agent.AgentCommand** { *; }
-dontwarn dadb.**
