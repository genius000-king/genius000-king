package com.genius.imlaq.ui

import java.util.Locale

/**
 * Model sizes in decimal gigabytes with one decimal, the unit Hugging Face and the phone's own
 * storage settings use, so "18.6" here is the same "18.6" the user sees everywhere else.
 */
fun formatGb(bytes: Long): String = String.format(Locale.US, "%.1f", bytes / 1e9)
