import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
    id("com.google.devtools.ksp")
    id("com.google.gms.google-services")
}

// The App Check debug token lives in local.properties, which is never committed.
val localProps = Properties().apply {
    val f = rootProject.file("local.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
val appCheckDebugToken: String = localProps.getProperty("appcheck.debug.token", "")

// Files shared with the web app are copied in at build time, never duplicated by hand.
val repoRoot = rootProject.projectDir.parentFile
val sharedAssets = layout.buildDirectory.dir("generated/sharedAssets")
val pantryAssets = layout.buildDirectory.dir("generated/pantryAssets")

val copySharedAssets by tasks.registering(Copy::class) {
    from(File(repoRoot, "shared")) { include("fbc-shelf-life-2018.json") }
    into(sharedAssets)
}

// The 16 pantry photos the web measurements used, for the on-device test on a real phone.
val copyPantryAssets by tasks.registering(Copy::class) {
    from(File(repoRoot, "web/public/testset/pantry-2026-11-15")) { include("*.jpg") }
    from(File(repoRoot, "results/labels")) { include("pantry-2026-11-15.json") }
    into(pantryAssets.map { it.dir("pantry") })
}

android {
    namespace = "com.keepuntil.sort"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.keepuntil.sort"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        debug {
            buildConfigField("String", "APPCHECK_DEBUG_TOKEN", "\"$appCheckDebugToken\"")
        }
        release {
            isMinifyEnabled = false
            buildConfigField("String", "APPCHECK_DEBUG_TOKEN", "\"\"")
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    sourceSets {
        getByName("main").assets.srcDir(sharedAssets)
        getByName("androidTest").assets.srcDir(pantryAssets)
    }

    testOptions {
        unitTests.all {
            // The gate tests read the chart and the web app's vectors straight from the repo.
            it.systemProperty("shared.dir", File(repoRoot, "shared").absolutePath)
        }
    }
}

kotlin {
    jvmToolchain(17)
}

tasks.named("preBuild") { dependsOn(copySharedAssets, copyPantryAssets) }

dependencies {
    implementation(platform("androidx.compose:compose-bom:2026.03.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.activity:activity-compose:1.12.4")
    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.10.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.10.0")

    implementation("androidx.camera:camera-core:1.6.2")
    implementation("androidx.camera:camera-camera2:1.6.2")
    implementation("androidx.camera:camera-lifecycle:1.6.2")
    implementation("androidx.camera:camera-view:1.6.2")

    // Firebase AI Logic with hybrid inference. The on-device SDK is not in the BoM yet.
    implementation(platform("com.google.firebase:firebase-bom:35.2.0"))
    implementation("com.google.firebase:firebase-ai:18.2.0")
    implementation("com.google.firebase:firebase-ai-ondevice:16.0.0-beta08")
    ksp("com.google.firebase:firebase-ai-ksp-processor:17.0.0")
    implementation("com.google.firebase:firebase-appcheck-debug")
    implementation("com.google.firebase:firebase-appcheck-playintegrity")
    implementation("com.google.firebase:firebase-auth")
    implementation("com.google.firebase:firebase-firestore")
    implementation("com.google.firebase:firebase-config")

    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.10.2")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.10.2")

    androidTestImplementation("androidx.test:runner:1.7.0")
    androidTestImplementation("androidx.test.ext:junit:1.3.0")
    androidTestImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.10.2")
}
