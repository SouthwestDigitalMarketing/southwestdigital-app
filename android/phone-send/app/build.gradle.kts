import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// The ripley address and the send signature are baked in at build time from a
// file that stays on ripley (see README.md), never from git.
val ripley = Properties().apply {
    val file = rootProject.file("ripley.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}

android {
    namespace = "com.southwestdigital.send"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.southwestdigital.send"
        minSdk = 29
        targetSdk = 35
        versionCode = 2
        versionName = "2.0"
        buildConfigField("String", "RIPLEY_URL", "\"${ripley.getProperty("url", "")}\"")
        buildConfigField("String", "SEND_EXP", "\"${ripley.getProperty("sexp", "")}\"")
        buildConfigField("String", "SEND_SIG", "\"${ripley.getProperty("ssig", "")}\"")
    }

    buildFeatures { buildConfig = true }

    signingConfigs {
        create("ripley") {
            storeFile = file(ripley.getProperty("keystore", "ripley.keystore"))
            storePassword = ripley.getProperty("keystorePassword", "")
            keyAlias = "send"
            keyPassword = ripley.getProperty("keystorePassword", "")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("ripley")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.work:work-runtime-ktx:2.9.1")
    implementation("androidx.core:core-ktx:1.13.1")
    // Opens SWapp itself full screen through Chrome (a Trusted Web Activity), so Google sign-in works.
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.5.0")
}
