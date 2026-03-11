package com.example.license

import android.content.Context
import android.provider.Settings

object DeviceIdProvider {
    fun getDeviceId(context: Context): String {
        return Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ANDROID_ID,
        ) ?: "unknown-device"
    }
}
