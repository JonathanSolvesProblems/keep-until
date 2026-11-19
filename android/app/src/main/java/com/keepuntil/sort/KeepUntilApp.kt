package com.keepuntil.sort

import android.app.Application
import android.content.Context
import com.google.firebase.Firebase
import com.google.firebase.FirebaseApp
import com.google.firebase.appcheck.appCheck
import com.google.firebase.appcheck.debug.DebugAppCheckProviderFactory
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory
import com.google.firebase.initialize

class KeepUntilApp : Application() {
    override fun onCreate() {
        super.onCreate()
        val app = Firebase.initialize(this) ?: FirebaseApp.getInstance()

        // Firebase AI Logic requires App Check. Debug builds use the debug provider with the
        // token from the gitignored local.properties, written into the provider's own store so
        // it is stable across installs; it is registered for this app in App Check. A release
        // build uses Play Integrity.
        if (BuildConfig.DEBUG && BuildConfig.APPCHECK_DEBUG_TOKEN.isNotEmpty()) {
            getSharedPreferences("com.google.firebase.appcheck.debug.store.${app.persistenceKey}", Context.MODE_PRIVATE)
                .edit()
                .putString("com.google.firebase.appcheck.debug.DEBUG_SECRET", BuildConfig.APPCHECK_DEBUG_TOKEN)
                .commit()
            Firebase.appCheck.installAppCheckProviderFactory(DebugAppCheckProviderFactory.getInstance())
        } else {
            Firebase.appCheck.installAppCheckProviderFactory(PlayIntegrityAppCheckProviderFactory.getInstance())
        }
    }
}
