// The sort screen: the item in the camera, one cobalt Read item button, and the answer
// flooding the panel in its colour. The brand is the web app's (.design/brand/CHARTER.md):
// dates and the name in the coder's dot matrix (Doto, capitals), every word in Atkinson
// Hyperlegible Next, cobalt only on Read item, and the colour of a decision never as text.
//
// Motion is the coder's, and only where it carries meaning (charter law 15): while a read is
// out, the print head runs along the button; when the answer lands, the panel takes its colour,
// the word sets, and the date prints column by column. The phone also says it in the hand: one
// firm pulse for keep, two light ticks for set aside, a long buzz for discard. With the system's
// animations off, everything appears at once.

package com.keepuntil.sort.ui

import android.os.Build
import android.provider.Settings
import android.view.HapticFeedbackConstants
import android.view.View
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Easing
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.keepuntil.sort.R
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.floor

private val Lid = Color(0xFFD0CEC8)
private val Carton = Color(0xFFF2F2EF)
private val Ink = Color(0xFF151515)
private val Ink2 = Color(0xFF3A3936)
private val Ink3 = Color(0xFF5A5955)
private val Edge = Color(0x24151515)
private val Glove = Color(0xFF2553C6)
private val KeepGreen = Color(0xFF1D7A46)
private val AsideYellow = Color(0xFFE3B628)
private val DiscardRed = Color(0xFFB2282D)
private val Viewport = Color(0xFF151515)

@OptIn(androidx.compose.ui.text.ExperimentalTextApi::class)
private val Dots = FontFamily(Font(R.font.doto, FontWeight.Black, variationSettings = FontVariation.Settings(FontVariation.weight(900))))

@OptIn(androidx.compose.ui.text.ExperimentalTextApi::class)
private val Words = FontFamily(
    Font(R.font.atkinson_next, FontWeight.Normal, variationSettings = FontVariation.Settings(FontVariation.weight(400))),
    Font(R.font.atkinson_next, FontWeight.SemiBold, variationSettings = FontVariation.Settings(FontVariation.weight(600))),
    Font(R.font.atkinson_next, FontWeight.Bold, variationSettings = FontVariation.Settings(FontVariation.weight(700))),
    Font(R.font.atkinson_next, FontWeight.ExtraBold, variationSettings = FontVariation.Settings(FontVariation.weight(800))),
)

private fun words(size: Int, weight: FontWeight = FontWeight.Normal, color: Color = Color.Unspecified) =
    TextStyle(fontFamily = Words, fontSize = size.sp, fontWeight = weight, color = color, lineHeight = (size * 1.3).sp)

private fun dots(size: Int, color: Color = Color.Unspecified) =
    TextStyle(fontFamily = Dots, fontSize = size.sp, fontWeight = FontWeight.Black, color = color, letterSpacing = (size * 0.03).sp, lineHeight = size.sp)

private fun fill(kind: Kind): Pair<Color, Color> = when (kind) {
    Kind.KEEP -> KeepGreen to Color.White
    Kind.SET_ASIDE -> AsideYellow to Ink
    Kind.DISCARD -> DiscardRed to Color.White
    Kind.TURN, Kind.NONE -> Carton to Ink
}

/** An inkjet head moves in steps, not smoothly: the reveal advances one column of dots at a time. */
private class Steps(private val n: Int) : Easing {
    override fun transform(fraction: Float) = floor(fraction * n) / n
}

/** "Remove animations" in the phone's settings sets the animator scale to 0. */
@Composable
private fun motionOn(): Boolean {
    val resolver = LocalContext.current.contentResolver
    return remember { Settings.Global.getFloat(resolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) != 0f }
}

/** The answer in the hand, for a volunteer looking at the item rather than the screen. */
private suspend fun pulse(view: View, kind: Kind) {
    val confirm = if (Build.VERSION.SDK_INT >= 30) HapticFeedbackConstants.CONFIRM else HapticFeedbackConstants.VIRTUAL_KEY
    val reject = if (Build.VERSION.SDK_INT >= 30) HapticFeedbackConstants.REJECT else HapticFeedbackConstants.LONG_PRESS
    when (kind) {
        Kind.KEEP -> view.performHapticFeedback(confirm)
        Kind.SET_ASIDE -> {
            view.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK)
            delay(140)
            view.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK)
        }
        Kind.DISCARD -> view.performHapticFeedback(reject)
        Kind.TURN, Kind.NONE -> view.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK)
    }
}

// Icons are dot-matrix pictograms on a 7 by 7 grid (charter law 9), the web's set plus a phone.
private val PHONE = listOf(".#####.", ".#...#.", ".#...#.", ".#...#.", ".#...#.", ".#####.", ".##.##.")
private val CLOUD = listOf(".......", "..##...", ".####.#", "#######", "#######", ".#####.", ".......")

@Composable
private fun DotIcon(rows: List<String>, color: Color, size: Dp = 16.dp) {
    Canvas(Modifier.size(size)) {
        val cell = this.size.width / 7f
        rows.forEachIndexed { y, row ->
            row.forEachIndexed { x, c ->
                if (c == '#') drawCircle(color, radius = cell * 0.42f, center = Offset((x + 0.5f) * cell, (y + 0.5f) * cell))
            }
        }
    }
}

/** Seven dots, one lit and moving left to right, the way a coder's head crosses a lid. */
@Composable
private fun PrintHead(color: Color, motion: Boolean) {
    val head = if (motion) {
        val t = rememberInfiniteTransition(label = "head")
        t.animateFloat(0f, 7f, infiniteRepeatable(tween(840, easing = LinearEasing), RepeatMode.Restart), label = "pos").value
    } else {
        -1f
    }
    Row(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalAlignment = Alignment.CenterVertically) {
        repeat(7) { i ->
            val lit = i == floor(head).toInt()
            val trail = i == floor(head).toInt() - 1
            Box(Modifier.size(7.dp).clip(RoundedCornerShape(50)).background(color.copy(alpha = if (lit) 1f else if (trail) 0.6f else 0.28f)))
        }
    }
}

@Composable
fun SortScreen(state: SortState, camera: @Composable (Modifier) -> Unit, onStart: () -> Unit, onRead: () -> Unit, onSample: () -> Unit) {
    val motion = motionOn()
    val view = LocalView.current
    // After each read the answer is brought into view, so the volunteer never scrolls with an
    // item in their hand (the web does the same at phone width), and the phone says it in the hand.
    val list = rememberLazyListState()
    LaunchedEffect(state.answerSeq) {
        val a = state.answer ?: return@LaunchedEffect
        if (state.answerSeq == 0) return@LaunchedEffect
        launch { pulse(view, a.kind) }
        list.animateScrollToItem(if (state.started) 3 else 2)
    }
    // While a read is out, the item being read is in view (the camera, or the sample photo); the
    // answer is brought down when it lands.
    LaunchedEffect(state.reading) {
        if (state.reading) list.animateScrollToItem(0)
    }
    // Read item stays at the bottom of the screen, under the thumb, while the answer and the
    // shift scroll above it: the volunteer never scrolls back up to read the next item.
    var bar by remember { mutableIntStateOf(0) }
    val density = LocalDensity.current
    Box(Modifier.fillMaxSize().background(Lid).safeDrawingPadding()) {
    LazyColumn(
        state = list,
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = if (state.started) with(density) { bar.toDp() } else 0.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item(key = "head") {
            Column(Modifier.padding(start = 16.dp, end = 16.dp, top = 14.dp)) {
                Text("KEEP UNTIL", style = dots(28, Ink), modifier = Modifier.semantics { contentDescription = "Keep Until" })
                Spacer(Modifier.height(6.dp))
                Text(state.status, style = words(13, color = Ink2))
            }
        }
        item(key = "camera") {
            Box(
                Modifier.padding(horizontal = 16.dp).fillMaxWidth().aspectRatio(4f / 3f).clip(RoundedCornerShape(6.dp)).background(Viewport),
                contentAlignment = Alignment.Center,
            ) {
                if (state.started) {
                    camera(Modifier.fillMaxSize())
                    state.still?.let {
                        Image(
                            bitmap = it,
                            contentDescription = "The sample photo being read",
                            contentScale = ContentScale.Fit,
                            modifier = Modifier.fillMaxSize().background(Viewport),
                        )
                    }
                } else {
                    Button(
                        onClick = onStart,
                        shape = RoundedCornerShape(6.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Carton, contentColor = Ink),
                        modifier = Modifier.height(64.dp),
                    ) { Text("Start shift", style = words(22, FontWeight.Bold)) }
                    Text(
                        "The camera turns on when the shift starts",
                        style = words(13, color = Color(0xFFD8D7D2)),
                        modifier = Modifier.align(Alignment.BottomStart).padding(16.dp),
                    )
                }
            }
        }
        if (state.started) {
            item(key = "controls") {
                Text(state.sampleNote, style = words(13, color = Ink2), modifier = Modifier.padding(horizontal = 16.dp))
            }
        }
        item(key = "answer") { AnswerPanel(state, motion) }
        item(key = "shift") { ShiftHeader(state.log, motion) }
        itemsIndexed(state.log, key = { _, row -> row.id }) { i, row ->
            LogRow(
                row,
                first = i == 0,
                last = i == state.log.lastIndex,
                modifier = Modifier.animateItem(
                    fadeInSpec = if (motion) tween(240) else snap(),
                    placementSpec = if (motion) spring(stiffness = 500f) else snap(),
                    fadeOutSpec = snap(),
                ),
            )
        }
        item(key = "foot") {
            Text(
                "Keep-until dates come from Food Banks Canada's Guidelines for Food Shelf Life (July 2018). " +
                    "Built by Jonathan Andrei for food bank sort tables. More of what I build at jonathansolvesproblems.com.",
                style = words(12, color = Ink2),
                modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 28.dp),
            )
        }
        // Early in a shift the list is too short for the answer to reach the top, and a strip of
        // the photo hung above it. This room lets it scroll all the way.
        if (state.started && state.log.size < 4) item(key = "room") { Spacer(Modifier.fillParentMaxHeight(0.5f)) }
    }
    if (state.started) {
        ActionBar(state, motion, onRead, onSample, Modifier.align(Alignment.BottomCenter).onSizeChanged { bar = it.height })
    }
    }
}

@Composable
private fun ActionBar(state: SortState, motion: Boolean, onRead: () -> Unit, onSample: () -> Unit, modifier: Modifier) {
    Column(
        modifier.fillMaxWidth().background(Lid)
            .drawBehind { drawRect(Edge, size = androidx.compose.ui.geometry.Size(size.width, 1.dp.toPx())) }
            .padding(start = 16.dp, end = 16.dp, top = 10.dp, bottom = 12.dp),
    ) {
        if (state.prompt.isNotEmpty()) {
            Text(state.prompt, style = words(16, FontWeight.SemiBold, Ink2))
            Spacer(Modifier.height(10.dp))
        }
        androidx.compose.material3.OutlinedButton(
            onClick = onSample,
            enabled = !state.reading,
            shape = RoundedCornerShape(6.dp),
            border = androidx.compose.foundation.BorderStroke(1.5.dp, if (state.reading) Ink.copy(alpha = 0.3f) else Ink),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = Ink),
            modifier = Modifier.fillMaxWidth().height(48.dp),
        ) { Text(state.sampleLabel, style = words(16, FontWeight.SemiBold)) }
        Spacer(Modifier.height(8.dp))
        Button(
            onClick = onRead,
            enabled = !state.reading,
            shape = RoundedCornerShape(6.dp),
            // Still cobalt while a read is out: the button is busy, not broken.
            colors = ButtonDefaults.buttonColors(containerColor = Glove, contentColor = Color.White, disabledContainerColor = Glove, disabledContentColor = Color.White),
            modifier = Modifier.fillMaxWidth().height(64.dp),
        ) {
            if (state.reading) {
                PrintHead(Color.White, motion)
                Spacer(Modifier.width(14.dp))
                Text("Reading", style = words(22, FontWeight.Bold))
            } else {
                Text("Read item", style = words(22, FontWeight.Bold))
            }
        }
    }
}

@Composable
private fun AnswerPanel(state: SortState, motion: Boolean) {
    val a = state.answer
    val (bg, fg) = if (a == null) Carton to Ink else fill(a.kind)
    val ink = fg
    // The arrival, in four beats: the new colour runs across the panel from the left, the way the
    // head lays ink (blending yellow into red passed through a muddy orange), the word sets, the
    // date prints, then the reason and the badge.
    var under by remember { mutableStateOf(bg) }
    var over by remember { mutableStateOf(bg) }
    val flood = remember { Animatable(1f) }
    val word = remember { Animatable(1f) }
    val print = remember { Animatable(1f) }
    val rest = remember { Animatable(1f) }
    LaunchedEffect(state.answerSeq) {
        if (state.answerSeq == 0 || !motion) {
            under = bg; over = bg
            flood.snapTo(1f); word.snapTo(1f); print.snapTo(1f); rest.snapTo(1f)
            return@LaunchedEffect
        }
        under = over; over = bg
        flood.snapTo(0f); word.snapTo(0f); print.snapTo(0f); rest.snapTo(0f)
        launch { flood.animateTo(1f, tween(260, easing = FastOutSlowInEasing)) }
        delay(90)
        launch { word.animateTo(1f, tween(240, easing = FastOutSlowInEasing)) }
        launch { delay(170); print.animateTo(1f, tween(340, easing = Steps(14))) }
        delay(380)
        rest.animateTo(1f, tween(220))
    }
    val printing = Modifier.drawWithContent { clipRect(right = size.width * print.value) { this@drawWithContent.drawContent() } }
    val setting = Modifier.graphicsLayer { alpha = word.value; translationY = (1f - word.value) * 18.dp.toPx() }
    val after = Modifier.graphicsLayer { alpha = rest.value }
    // While the next item is being read, the last answer steps back: it is about the item before.
    val stale by androidx.compose.animation.core.animateFloatAsState(
        if (state.reading && a != null) 0.35f else 1f, if (motion) tween(180) else snap(), label = "stale",
    )

    Column(
        Modifier.padding(horizontal = 16.dp).graphicsLayer { alpha = stale }.fillMaxWidth().clip(RoundedCornerShape(6.dp))
            .drawBehind {
                drawRect(under)
                drawRect(over, size = androidx.compose.ui.geometry.Size(size.width * flood.value, size.height))
            }
            .then(if (a == null || a.kind == Kind.TURN || a.kind == Kind.NONE) Modifier.border(1.dp, Edge, RoundedCornerShape(6.dp)) else Modifier)
            .padding(20.dp),
    ) {
        if (a == null) {
            // The waiting state shows the job: gloved hands holding a can up, in the coder's dots.
            Image(
                painterResource(R.drawable.art_hands_can),
                contentDescription = "Two gloved hands holding a can up with its lid toward the camera",
                modifier = Modifier.fillMaxWidth().height(150.dp),
                alignment = Alignment.CenterStart,
                contentScale = ContentScale.Fit,
            )
            Spacer(Modifier.height(12.dp))
            Text("Hold an item up to the camera", style = words(26, FontWeight.ExtraBold, Ink))
            Spacer(Modifier.height(8.dp))
            Text("Date side first. Keep Until reads the stamp, checks Food Banks Canada's chart, and tells you which box it goes in.", style = words(16, color = Ink3))
            Spacer(Modifier.height(16.dp))
            Box(Modifier.fillMaxWidth().height(1.dp).background(Edge))
            Spacer(Modifier.height(14.dp))
            Text("2027 FE 14", style = dots(34, Ink), modifier = Modifier.semantics { contentDescription = "A sample date stamp: 2027 FE 14" })
            Spacer(Modifier.height(6.dp))
            Text("A Canadian date stamp: year, a two-letter month, then the day. Look on the top, the bottom or a seam.", style = words(13, color = Ink3))
            return@Column
        }
        Text(a.word, style = words(if (a.word.length > 10) 44 else 64, FontWeight.ExtraBold, ink).copy(lineHeight = 64.sp), modifier = setting)
        when {
            a.until != null -> Row(verticalAlignment = Alignment.Bottom, modifier = setting) {
                Text("until ", style = words(22, FontWeight.SemiBold, ink))
                Text(shortDate(a.until), style = dots(32, ink), modifier = printing)
            }
            a.sub != null -> Text(a.sub, style = words(22, FontWeight.SemiBold, ink), modifier = setting)
        }
        if (a.stampCode != null) {
            Spacer(Modifier.height(18.dp))
            Box(Modifier.fillMaxWidth().height(1.5.dp).background(ink.copy(alpha = 0.35f)))
            Spacer(Modifier.height(16.dp))
            Text(a.stampCode, style = dots(30, ink), modifier = printing.semantics { contentDescription = "Stamped on the package: ${a.stampCode}" })
            Spacer(Modifier.height(4.dp))
            Text(a.stampPlain ?: "", style = words(17, FontWeight.Bold, ink), modifier = after)
        }
        Column(after) {
            Spacer(Modifier.height(14.dp))
            Text(a.reason, style = words(19, color = ink))
            if (a.source != null) Text(a.source, style = words(15, color = ink))
            if (state.readBy.isNotEmpty()) {
                Spacer(Modifier.height(14.dp))
                ReadByBadge(state.readBy, ink)
            }
        }
    }
}

/** Where the answer was read (charter law 12), with the place drawn in dots before it is said. */
@Composable
private fun ReadByBadge(text: String, ink: Color) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        modifier = Modifier.border(1.dp, ink.copy(alpha = 0.4f), RoundedCornerShape(6.dp)).padding(horizontal = 12.dp, vertical = 8.dp),
    ) {
        if (text.contains("on this phone")) DotIcon(PHONE, ink)
        if (text.contains("cloud")) DotIcon(CLOUD, ink)
        Spacer(Modifier.width(2.dp))
        Text(text, style = words(13, FontWeight.SemiBold, ink))
    }
}

/** This shift at a glance: how many items went in each box, counted as they land. */
@Composable
private fun ShiftHeader(log: List<LoggedRow>, motion: Boolean) {
    Column(Modifier.padding(horizontal = 16.dp)) {
        Spacer(Modifier.height(6.dp))
        Text("This shift", style = words(26, FontWeight.ExtraBold, Ink))
        Spacer(Modifier.height(10.dp))
        if (log.isEmpty()) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "Nothing sorted yet. The first item you read shows up here and in the food bank's log.",
                    style = words(15, color = Ink2),
                    modifier = Modifier.weight(1f),
                )
                Spacer(Modifier.width(12.dp))
                Image(
                    painterResource(R.drawable.art_sheet),
                    contentDescription = "A gloved hand writing on a clipboard log sheet",
                    modifier = Modifier.size(110.dp),
                    contentScale = ContentScale.Fit,
                )
            }
            return@Column
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Tally(log.count { it.answer.kind == Kind.KEEP }, "kept", KeepGreen, motion, Modifier.weight(1f))
            Tally(log.count { it.answer.kind == Kind.SET_ASIDE }, "set aside", AsideYellow, motion, Modifier.weight(1f))
            Tally(log.count { it.answer.kind == Kind.DISCARD }, "discarded", DiscardRed, motion, Modifier.weight(1f))
        }
    }
}

@Composable
private fun Tally(count: Int, label: String, colour: Color, motion: Boolean, modifier: Modifier) {
    Column(modifier.semantics(mergeDescendants = true) {}) {
        Box(Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(2.dp)).background(colour))
        Spacer(Modifier.height(6.dp))
        AnimatedContent(
            targetState = count,
            transitionSpec = {
                if (motion) (slideInVertically(tween(220)) { it / 2 } + fadeIn(tween(220))) togetherWith (slideOutVertically(tween(160)) { -it / 2 } + fadeOut(tween(160)))
                else fadeIn(snap()) togetherWith fadeOut(snap())
            },
            label = label,
        ) { n -> Text("$n", style = words(34, FontWeight.ExtraBold, Ink).copy(lineHeight = 38.sp)) }
        Text(label, style = words(14, FontWeight.SemiBold, Ink2))
    }
}

/**
 * One item, set like a label on the box it went into: the decision's colour runs the full height
 * of the row with its word on it, then what was read. The rows sit on one carton sheet.
 */
@Composable
private fun LogRow(row: LoggedRow, first: Boolean, last: Boolean, modifier: Modifier) {
    val (bg, fg) = fill(row.answer.kind)
    val shape = RoundedCornerShape(
        topStart = if (first) 6.dp else 0.dp, topEnd = if (first) 6.dp else 0.dp,
        bottomStart = if (last) 6.dp else 0.dp, bottomEnd = if (last) 6.dp else 0.dp,
    )
    Column(modifier.padding(horizontal = 16.dp).fillMaxWidth().clip(shape).background(Carton)) {
        if (!first) Box(Modifier.fillMaxWidth().height(1.dp).background(Edge))
        Row(Modifier.height(IntrinsicSize.Min).fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.width(98.dp).fillMaxHeight().background(bg).padding(horizontal = 12.dp, vertical = 14.dp), contentAlignment = Alignment.CenterStart) {
                Text(row.answer.word, style = words(16, FontWeight.ExtraBold, fg))
            }
            Column(Modifier.weight(1f).padding(horizontal = 14.dp, vertical = 12.dp)) {
                Text(row.name, style = words(16, FontWeight.Bold, Ink))
                Text(row.answer.stampPlain ?: row.answer.reason, style = words(13, color = Ink3))
                if (row.answer.until != null) {
                    Spacer(Modifier.height(6.dp))
                    Row(verticalAlignment = Alignment.Bottom) {
                        Text("keep until ", style = words(13, FontWeight.SemiBold, Ink2))
                        Text(shortDate(row.answer.until), style = dots(18, Ink))
                    }
                }
            }
        }
    }
}
