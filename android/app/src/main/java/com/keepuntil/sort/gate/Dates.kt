// Parses the date text a model read off a package into calendar dates.
//
// This is a line-for-line port of web/src/chart/dates.ts, and it is held to it: every answer
// is checked against shared/gate-vectors.json, which the TypeScript version writes
// (GateVectorsTest). Change the two together or the test fails.
//
// Canadian rules (CFIA, "Date markings and storage instructions", read 2026-11-14): the year
// comes first and may be left out when the date is clear, then the month as a bilingual
// symbol, then the day: "17 JN 28" is 2017-06-28, "JN 28" has no year. "MA" is May, and it is
// also the second half of the "BB/MA" prefix, so the prefix is stripped with care.
//
// The parser never guesses between two readings. It returns every plausible candidate and
// lets the chart gate decide whether the candidates agree.

package com.keepuntil.sort.gate

import java.text.Normalizer
import java.time.LocalDate

sealed interface ParsedDate {
    data class Exact(val iso: String, val precision: String) : ParsedDate
    data class Ambiguous(val candidates: List<String>, val why: String) : ParsedDate
    data class Unreadable(val why: String) : ParsedDate
}

private val CFIA_SYMBOLS = mapOf(
    "JA" to 1, "FE" to 2, "MR" to 3, "AL" to 4, "MA" to 5, "JN" to 6,
    "JL" to 7, "AU" to 8, "SE" to 9, "OC" to 10, "NO" to 11, "DE" to 12,
)

private val MONTH_WORDS = mapOf(
    "JAN" to 1, "JANUARY" to 1, "JANV" to 1, "JANVIER" to 1,
    "FEB" to 2, "FEBRUARY" to 2, "FEV" to 2, "FEVR" to 2, "FEVRIER" to 2,
    "MAR" to 3, "MARCH" to 3, "MARS" to 3,
    "APR" to 4, "APRIL" to 4, "AVR" to 4, "AVRIL" to 4,
    "MAY" to 5, "MAI" to 5,
    "JUN" to 6, "JUNE" to 6, "JUIN" to 6,
    "JUL" to 7, "JULY" to 7, "JUIL" to 7, "JUILLET" to 7,
    "AUG" to 8, "AUGUST" to 8, "AOUT" to 8,
    "SEP" to 9, "SEPT" to 9, "SEPTEMBER" to 9, "SEPTEMBRE" to 9,
    "OCT" to 10, "OCTOBER" to 10, "OCTOBRE" to 10,
    "NOV" to 11, "NOVEMBER" to 11, "NOVEMBRE" to 11,
    "DEC" to 12, "DECEMBER" to 12, "DECEMBRE" to 12,
)

private val PREFIX = Regex(
    "^(?:" +
        listOf(
            "BEST\\s*BEFORE\\s*/?\\s*MEILLEUR\\s*AVANT",
            "MEILLEUR\\s*AVANT",
            "BEST\\s*BEFORE",
            "BEST\\s*BY",
            "BB\\s*/\\s*MA",
            "BBD",
            "BB",
            "EXPIRY\\s*DATE",
            "EXPIRATION\\s*DATE",
            "DATE\\s*LIMITE\\s*D'UTILISATION",
            "EXPIRY",
            "EXP",
            "USE\\s*BY",
            "PACKAGED\\s*ON\\s*/?\\s*EMPAQUETE\\s*LE",
            "PACKAGED\\s*ON",
            "EMPAQUETE\\s*LE",
        ).joinToString("|") +
        ")[\\s:./-]*",
)

private val COMBINING_MARKS = Regex("[\\u0300-\\u036f]")
private val TOKEN = Regex("[A-Z]+|\\d+")
private val LONE_MA = Regex("\\bMA\\b")
private val BB_ONLY = Regex("^(BEST\\s*BEFORE|BB)[\\s:./-]*")
private val SEPARATORS = Regex("[\\s./-]+")
private val DIGITS = Regex("^\\d+$")

private fun stripAccents(s: String): String = COMBINING_MARKS.replace(Normalizer.normalize(s, Normalizer.Form.NFD), "")

private fun stripPrefixes(text: String): String {
    var t = text
    repeat(4) {
        val next = PREFIX.replaceFirst(t, "")
        if (next == t) return t
        t = next.trim()
    }
    return t
}

private fun tokenize(text: String): List<String> = TOKEN.findAll(text).map { it.value }.toList()

private fun monthOf(token: String?): Int? = token?.let { CFIA_SYMBOLS[it] ?: MONTH_WORDS[it] }

/** A digit run as a number. Runs too long for a date (lot codes) become a value no date accepts. */
private fun num(digits: String): Long = digits.toLongOrNull() ?: Long.MAX_VALUE

/** Null for a token that is not a year, and for year zero (which the web version treats as no year). */
private fun expandYear(token: String): Long? = when (token.length) {
    4 -> num(token).takeIf { it != 0L }
    2 -> 2000 + num(token)
    else -> null
}

private fun isoOf(y: Long, m: Long, d: Long): String? {
    // Years under 100 never make a date here, as in the web version (JavaScript reads them as 19xx).
    if (m < 1 || m > 12 || d < 1 || d > 31 || y < 100 || y > 9999) return null
    return try {
        LocalDate.of(y.toInt(), m.toInt(), d.toInt()).toString()
    } catch (e: java.time.DateTimeException) {
        null
    }
}

private fun addDaysIso(iso: String, days: Long): String = LocalDate.parse(iso).plusDays(days).toString()

private fun result(candidates: List<String?>, why: String): ParsedDate {
    val ok = candidates.filterNotNull().distinct().sorted()
    return when (ok.size) {
        0 -> ParsedDate.Unreadable("no valid calendar date in $why")
        1 -> ParsedDate.Exact(ok[0], "day")
        else -> ParsedDate.Ambiguous(ok, why)
    }
}

/**
 * Fills in a missing year. CFIA lets the year be left out only when it is clear, which in
 * practice means short shelf-life products. So a plausible reading sits no more than 180 days
 * behind the sort and no more than 120 days ahead of it.
 */
private fun withoutYear(m: Int, d: Long, today: String): ParsedDate {
    val y = today.substring(0, 4).toLong()
    val lower = addDaysIso(today, -180)
    val upper = addDaysIso(today, 120)
    val plausible = listOf(y - 1, y, y + 1).map { isoOf(it, m.toLong(), d) }.filter { it != null && it > lower && it <= upper }
    return result(plausible, "month and day with no year")
}

/**
 * A misread digit can turn a real stamp into a calendar-valid date centuries away: the cloud
 * read a cut-off "2027" as "5037" on 15 November 2026 and the gate said keep. A stamp year
 * more than 15 behind or 7 ahead of the sort date is refused as unreadable.
 */
private const val YEARS_BEHIND = 15
private const val YEARS_AHEAD = 7

fun parseDateText(raw: String, today: String): ParsedDate {
    val parsed = parseStamp(raw, today)
    val y = today.substring(0, 4).toInt()
    fun ok(iso: String): Boolean {
        val yy = iso.substring(0, 4).toInt()
        return yy >= y - YEARS_BEHIND && yy <= y + YEARS_AHEAD
    }
    if (parsed is ParsedDate.Exact && !ok(parsed.iso)) {
        return ParsedDate.Unreadable("year ${parsed.iso.substring(0, 4)} is not a plausible date stamp")
    }
    if (parsed is ParsedDate.Ambiguous && parsed.candidates.none(::ok)) {
        // An ambiguous stamp stays ambiguous (the lead decides); it is never narrowed to one date here.
        return ParsedDate.Unreadable("no plausible year among " + parsed.candidates.joinToString(", "))
    }
    return parsed
}

private fun parseStamp(raw: String, today: String): ParsedDate {
    val upper = stripAccents(raw).uppercase().trim()
    if (upper.isEmpty()) return ParsedDate.Unreadable("empty")

    var body = stripPrefixes(upper)
    var tokens = tokenize(body)

    // "BB MA 14" can mean best before, May 14. If stripping a bare "BB" left no month at all
    // but the original had a lone "MA", put the MA back as the month.
    if (tokens.none { monthOf(it) != null } && LONE_MA.containsMatchIn(upper)) {
        body = BB_ONLY.replaceFirst(upper, "")
        tokens = tokenize(body)
    }

    // "BB MA 2026 JA 14": the MA belongs to the prefix when another month follows it.
    if (tokens.firstOrNull() == "MA" && tokens.drop(1).any { monthOf(it) != null }) {
        tokens = tokens.drop(1)
    }

    fun isNum(t: String?): Boolean = t != null && DIGITS.matches(t)
    val alphaIdx = tokens.indexOfFirst { monthOf(it) != null }

    if (alphaIdx >= 0) {
        val symbol = tokens[alphaIdx]
        val m = monthOf(symbol)!!
        val isCfia = symbol.length == 2
        // Only the numbers touching the month belong to the date; a lot code elsewhere on the
        // same line ("L2345 26 JA 14") is ignored.
        val before = tokens.getOrNull(alphaIdx - 1)?.takeIf { isNum(it) }
        val after = mutableListOf<String>()
        var i = alphaIdx + 1
        while (i < tokens.size && after.size < 2 && isNum(tokens[i])) after.add(tokens[i++])

        // CFIA order: [year] month day
        if (before != null && after.isNotEmpty()) {
            val a = before
            val b = after[0]
            if (isCfia) {
                val y = expandYear(a) ?: return ParsedDate.Unreadable("year token $a")
                return result(listOf(isoOf(y, m.toLong(), num(b))), "CFIA year-month-day")
            }
            // English or French month word between two numbers.
            if (a.length == 4) return result(listOf(isoOf(num(a), m.toLong(), num(b))), "year-month-day")
            if (b.length == 4) return result(listOf(isoOf(num(b), m.toLong(), num(a))), "day-month-year")
            val y1 = expandYear(a)
            val y2 = expandYear(b)
            return result(
                listOf(y1?.let { isoOf(it, m.toLong(), num(b)) }, y2?.let { isoOf(it, m.toLong(), num(a)) }),
                "two-digit numbers on both sides of the month",
            )
        }
        if (before == null && after.size == 2) {
            // "JAN 14 2026" or "JA 14 26"
            val (d, y) = after
            val yy = expandYear(y)
            if (yy != null && num(d) <= 31) return result(listOf(isoOf(yy, m.toLong(), num(d))), "month-day-year")
            return ParsedDate.Unreadable("month followed by " + after.joinToString(" "))
        }
        if (before == null && after.size == 1) {
            val n = after[0]
            if (n.length == 4) {
                val iso = isoOf(num(n), m.toLong(), 1)
                return if (iso != null) ParsedDate.Exact(iso, "month") else ParsedDate.Unreadable("month and year")
            }
            // "JN 28": month and day, year omitted (CFIA allows it when clear)
            return withoutYear(m, num(n), today)
        }
        if (before != null && after.isEmpty()) {
            if (before.length == 4) {
                val iso = isoOf(num(before), m.toLong(), 1)
                return if (iso != null) ParsedDate.Exact(iso, "month") else ParsedDate.Unreadable("year and month")
            }
            return withoutYear(m, num(before), today)
        }
        val count = (if (before != null) 1 else 0) + after.size
        return ParsedDate.Unreadable("month with $count numbers around it")
    }

    // Numbers only. Separated parts are dates; a solid run of digits is usually a lot code.
    val parts = body.split(SEPARATORS).filter { DIGITS.matches(it) }
    if (parts.size == 3) {
        val (a, b, c) = parts
        if (a.length == 4) return result(listOf(isoOf(num(a), num(b), num(c))), "year-month-day")
        if (c.length == 4 || c.length == 2) {
            val y = expandYear(c) ?: 0L
            return result(listOf(isoOf(y, num(b), num(a)), isoOf(y, num(a), num(b))), "numeric day and month in an unknown order")
        }
    }
    if (parts.size == 2 && (parts[0].length == 4 || parts[1].length == 4)) {
        val (y, m) = if (parts[0].length == 4) parts[0] to parts[1] else parts[1] to parts[0]
        val iso = isoOf(num(y), num(m), 1)
        return if (iso != null) ParsedDate.Exact(iso, "month") else ParsedDate.Unreadable("numeric year and month")
    }
    return ParsedDate.Unreadable("no month and no separated date parts (likely a lot code)")
}
