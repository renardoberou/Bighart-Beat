plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Release signing is entirely environment-driven (set by android-release.yml
// from repo secrets). When the env vars are absent — every debug build — the
// release build type simply stays unsigned and nothing here evaluates.
val ksFile: String? = System.getenv("KEYSTORE_FILE")

android {
    namespace = "com.resonantsystems.bighartbeat"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.resonantsystems.bighartbeat"
        minSdk = 26
        targetSdk = 35
        // Bump this before each Play/public release; package updates require a monotonically increasing versionCode.
        versionCode = (System.getenv("VERSION_CODE") ?: "1").toInt()
        // versionName comes from the release tag (app-v1.2.0 → 1.2.0); fallback for debug
        versionName = System.getenv("VERSION_NAME") ?: "1.0.0"
    }

    signingConfigs {
        if (ksFile != null) {
            create("release") {
                storeFile = file(ksFile)
                storePassword = System.getenv("KEYSTORE_PASS")
                keyAlias = System.getenv("KEY_ALIAS")
                keyPassword = System.getenv("KEY_PASS")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            if (ksFile != null) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.11.0")
}

// Single source of truth: the instrument is the LIVE web app at the repo
// root (index.html + src/ + styles/) — the same files GitHub Pages serves.
// They are synced into assets/ at build time and never committed there, so
// the APK can never drift from the deployed instrument. Sync (not Copy)
// removes stale assets when web files are renamed or deleted.
val syncInstrument by tasks.registering(Sync::class) {
    val repoRoot = rootProject.layout.projectDirectory.dir("..")
    from(repoRoot.file("index.html"))
    from(repoRoot.dir("src")) { into("src") }
    from(repoRoot.dir("styles")) { into("styles") }
    into(layout.projectDirectory.dir("src/main/assets"))
}

tasks.named("preBuild") {
    dependsOn(syncInstrument)
}
