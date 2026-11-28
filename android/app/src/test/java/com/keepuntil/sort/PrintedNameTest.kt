package com.keepuntil.sort

import com.keepuntil.sort.loop.printedName
import org.junit.Assert.assertEquals
import org.junit.Test

/** The same cases as "printedName: the brand said once" in web/src/ai/loop.test.ts. */
class PrintedNameTest {
    @Test
    fun `drops a brand the product already carries`() {
        assertEquals("Campbell's Chicken Broth", printedName("Campbell's", "Campbell's Chicken Broth"))
        assertEquals("Campbell's Chicken Broth", printedName("CAMPBELL’S", "Campbell's Chicken Broth"))
    }

    @Test
    fun `collapses a brand the read doubled itself`() {
        assertEquals("Campbell's Chicken Broth", printedName("Campbell's", "Campbell's Campbell's Chicken Broth"))
        assertEquals("Liberté Grec", printedName("Liberté", "Liberté Liberté Grec"))
    }

    @Test
    fun `joins a brand the product does not carry, and keeps either one alone`() {
        assertEquals("Yum Natural Peanut Butter", printedName("Yum", "Natural Peanut Butter"))
        assertEquals("Chipits", printedName("", "Chipits"))
        assertEquals("Chipits", printedName("Chipits", ""))
    }
}
