import { Navbar } from '@/components/Navbar'
import { Hero } from '@/components/Hero'
import { Pain } from '@/components/Pain'
import { HowItWorks } from '@/components/HowItWorks'
import { Features } from '@/components/Features'
import { ForWhom } from '@/components/ForWhom'
import { CtaSection } from '@/components/CtaSection'
import { Faq } from '@/components/Faq'
import { Footer } from '@/components/Footer'

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Pain />
        <HowItWorks />
        <Features />
        <ForWhom />
        <CtaSection />
        <Faq />
      </main>
      <Footer />
    </>
  )
}
