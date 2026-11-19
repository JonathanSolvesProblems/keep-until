package com.keepuntil.sort

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.ImageProxy
import androidx.camera.view.LifecycleCameraController
import androidx.camera.view.PreviewView
import androidx.compose.runtime.getValue
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.keepuntil.sort.ui.SortScreen
import com.keepuntil.sort.ui.SortViewModel

class MainActivity : ComponentActivity() {
    private val vm: SortViewModel by viewModels()
    private lateinit var camera: LifecycleCameraController

    private val askCamera = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) vm.startShift() else vm.cameraFailed()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        camera = LifecycleCameraController(this).apply {
            cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA
            setEnabledUseCases(LifecycleCameraController.IMAGE_CAPTURE)
            imageCaptureMode = ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY
        }
        camera.bindToLifecycle(this)

        setContent {
            val state by vm.state.collectAsStateWithLifecycle()
            SortScreen(
                state = state,
                camera = { modifier ->
                    AndroidView(
                        factory = { ctx -> PreviewView(ctx).apply { controller = camera; scaleType = PreviewView.ScaleType.FILL_CENTER } },
                        modifier = modifier,
                    )
                },
                onStart = {
                    if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) vm.startShift()
                    else askCamera.launch(Manifest.permission.CAMERA)
                },
                onRead = ::capture,
                onSample = vm::readSample,
            )
        }
    }

    /** One still from the camera, upright, at the sizes the loop wants. */
    private fun capture() {
        camera.takePicture(
            ContextCompat.getMainExecutor(this),
            object : ImageCapture.OnImageCapturedCallback() {
                override fun onCaptureSuccess(image: ImageProxy) {
                    val upright = image.toBitmap().rotated(image.imageInfo.rotationDegrees)
                    image.close()
                    vm.readItem(upright.scaledTo(1024), upright.scaledTo(512))
                }

                override fun onError(exception: ImageCaptureException) = vm.cameraFailed()
            },
        )
    }
}

private fun Bitmap.rotated(degrees: Int): Bitmap {
    if (degrees == 0) return this
    val m = android.graphics.Matrix().apply { postRotate(degrees.toFloat()) }
    return Bitmap.createBitmap(this, 0, 0, width, height, m, true)
}

/** The longest side at most [maxSide] px: a sharp enough stamp, and small enough for the on-device model. */
fun Bitmap.scaledTo(maxSide: Int): Bitmap {
    val scale = minOf(1f, maxSide.toFloat() / maxOf(width, height))
    if (scale >= 1f) return this
    return Bitmap.createScaledBitmap(this, (width * scale).toInt(), (height * scale).toInt(), true)
}
