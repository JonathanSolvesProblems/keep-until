// The sort screen: the item in the camera, one cobalt Read item button, and the answer
// flooding the panel in its colour. The brand is the web app's (.design/brand/CHARTER.md):
// dates and the name in the coder's dot matrix (Doto, capitals), every word in Atkinson
// Hyperlegible Next, cobalt only on Read item, and the colour of a decision never as text.

package com.keepuntil.sort.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.keepuntil.sort.R

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

@Composable
fun SortScreen(state: SortState, camera: @Composable (Modifier) -> Unit, onStart: () -> Unit, onRead: () -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().background(Lid).safeDrawingPadding(),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Column(Modifier.padding(start = 16.dp, end = 16.dp, top = 14.dp)) {
                Text("KEEP UNTIL", style = dots(28, Ink), modifier = Modifier.semantics { contentDescription = "Keep Until" })
                Spacer(Modifier.height(6.dp))
                Text(state.status, style = words(13, color = Ink2))
            }
        }
        item {
            Box(
                Modifier.padding(horizontal = 16.dp).fillMaxWidth().aspectRatio(4f / 3f).clip(RoundedCornerShape(6.dp)).background(Viewport),
                contentAlignment = Alignment.Center,
            ) {
                if (state.started) {
                    camera(Modifier.fillMaxSize())
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
            item {
                Column(Modifier.padding(horizontal = 16.dp)) {
                    Button(
                        onClick = onRead,
                        enabled = !state.reading,
                        shape = RoundedCornerShape(6.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Glove, contentColor = Color.White, disabledContainerColor = Glove.copy(alpha = 0.5f), disabledContentColor = Color.White),
                        modifier = Modifier.fillMaxWidth().height(64.dp),
                    ) { Text(if (state.reading) "Reading" else "Read item", style = words(22, FontWeight.Bold)) }
                    if (state.prompt.isNotEmpty()) {
                        Spacer(Modifier.height(10.dp))
                        Text(state.prompt, style = words(16, FontWeight.SemiBold, Ink2))
                    }
                }
            }
        }
        item { AnswerPanel(state) }
        item {
            Column(Modifier.padding(horizontal = 16.dp)) {
                Text("This shift", style = words(26, FontWeight.ExtraBold, Ink))
                val kept = state.log.count { it.answer.kind == Kind.KEEP }
                val aside = state.log.count { it.answer.kind == Kind.SET_ASIDE }
                val binned = state.log.count { it.answer.kind == Kind.DISCARD }
                if (state.log.isNotEmpty()) {
                    Text(
                        "${state.log.size} ${if (state.log.size == 1) "item" else "items"}: $kept kept, $aside set aside, $binned discarded",
                        style = words(15, color = Ink2),
                    )
                } else {
                    Text("Nothing sorted yet. The first item you read shows up here and in the food bank's log.", style = words(15, color = Ink2))
                }
            }
        }
        items(state.log) { row -> LogRow(row) }
        item {
            Text(
                "Keep-until dates come from Food Banks Canada's Guidelines for Food Shelf Life (July 2018). " +
                    "Built by Jonathan Andrei for food bank sort tables. More of what I build at jonathansolvesproblems.com.",
                style = words(12, color = Ink2),
                modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 28.dp),
            )
        }
    }
}

@Composable
private fun AnswerPanel(state: SortState) {
    val a = state.answer
    val (bg, fg) = if (a == null) Carton to Ink else fill(a.kind)
    Column(
        Modifier.padding(horizontal = 16.dp).fillMaxWidth().clip(RoundedCornerShape(6.dp)).background(bg)
            .then(if (a == null || a.kind == Kind.TURN || a.kind == Kind.NONE) Modifier.border(1.dp, Edge, RoundedCornerShape(6.dp)) else Modifier)
            .padding(20.dp),
    ) {
        if (a == null) {
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
        Text(a.word, style = words(if (a.word.length > 10) 44 else 64, FontWeight.ExtraBold, fg).copy(lineHeight = 64.sp))
        when {
            a.until != null -> Row(verticalAlignment = Alignment.Bottom) {
                Text("until ", style = words(22, FontWeight.SemiBold, fg))
                Text(shortDate(a.until), style = dots(32, fg))
            }
            a.sub != null -> Text(a.sub, style = words(22, FontWeight.SemiBold, fg))
        }
        if (a.stampCode != null) {
            Spacer(Modifier.height(18.dp))
            Box(Modifier.fillMaxWidth().height(1.5.dp).background(fg.copy(alpha = 0.35f)))
            Spacer(Modifier.height(16.dp))
            Text(a.stampCode, style = dots(30, fg), modifier = Modifier.semantics { contentDescription = "Stamped on the package: ${a.stampCode}" })
            Spacer(Modifier.height(4.dp))
            Text(a.stampPlain ?: "", style = words(17, FontWeight.Bold, fg))
        }
        Spacer(Modifier.height(14.dp))
        Text(a.reason, style = words(19, color = fg))
        if (a.source != null) Text(a.source, style = words(15, color = fg))
        if (state.readBy.isNotEmpty()) {
            Spacer(Modifier.height(14.dp))
            Text(
                state.readBy,
                style = words(13, FontWeight.SemiBold, fg),
                modifier = Modifier.border(1.dp, fg.copy(alpha = 0.4f), RoundedCornerShape(6.dp)).padding(horizontal = 12.dp, vertical = 8.dp),
            )
        }
    }
}

@Composable
private fun LogRow(row: LoggedRow) {
    val (bg, fg) = fill(row.answer.kind)
    Row(
        Modifier.padding(horizontal = 16.dp).fillMaxWidth().clip(RoundedCornerShape(6.dp)).background(Carton)
            .border(1.dp, Edge, RoundedCornerShape(6.dp)).padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            row.answer.word,
            style = words(15, FontWeight.ExtraBold, fg),
            modifier = Modifier.clip(RoundedCornerShape(4.dp)).background(bg).padding(horizontal = 10.dp, vertical = 4.dp),
        )
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(row.name, style = words(16, FontWeight.Bold, Ink))
            Text(row.answer.stampPlain ?: row.answer.reason, style = words(13, color = Ink3))
        }
        if (row.answer.until != null) {
            Column(horizontalAlignment = Alignment.End) {
                Text("keep until", style = words(12, color = Ink2))
                Text(shortDate(row.answer.until), style = dots(18, Ink))
            }
        }
    }
}
