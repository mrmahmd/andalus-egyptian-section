import Link from "next/link";
import HomeReveal from "./home-reveal";

const features = [
  {
    number: "01",
    title: "Clear weekly learning",
    text: "Classwork, homework, and Classera notes arranged by subject and school day.",
  },
  {
    number: "02",
    title: "Updated by teachers",
    text: "Every subject teacher adds their own plan, so families always see the latest version.",
  },
  {
    number: "03",
    title: "Ready to print",
    text: "Open the complete weekly plan online or download a school-branded PDF in one click.",
  },
];

export default function Home() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  return (
    <HomeReveal>
      <div className="notice-bar">
        <span className="notice-dot" />
        Weekly plans are published every Thursday for the following school week.
      </div>

      <header className="site-header">
        <Link href="/" className="brand-lockup" aria-label="AlAndalus Private Schools home">
          <img src={`${basePath}/school-logo.jpeg`} alt="AlAndalus Private Schools" />
          <span className="brand-copy">
            <strong>ALANDALUS PRIVATE SCHOOLS</strong>
            <small>Egyptian Section · Weekly Study Plan</small>
          </span>
        </Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          <Link className="active" href="/">Home</Link>
          <Link href="/weekly-plan">Weekly Plan</Link>
          <Link href="/timetable">Timetable</Link>
          <a href="#how-it-works">How it works</a>
          <Link href="/support">Technical Support</Link>
        </nav>
        <Link className="button button-outline staff-link" href="/portal">School Portal <span aria-hidden="true">→</span></Link>
      </header>

      <section className="hero-section">
        <div className="hero-photo" style={{ backgroundImage: `url('${basePath}/school-building.jpeg')` }} role="img" aria-label="AlAndalus Egyptian School building and Egyptian Section entrance" />
        <div className="hero-wash" />
        <div className="hero-content page-width">
          <div className="hero-kicker"><span /> Egyptian Section</div>
          <h1>One clear plan.<br />A stronger school week.</h1>
          <p>
            Everything families need to follow lessons, homework, and teacher notes—beautifully organised in one place.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#plan-finder">Find your weekly plan <span aria-hidden="true">→</span></a>
            <Link className="button button-glass" href="/weekly-plan">View sample plan</Link>
          </div>
        </div>
        <div className="hero-year" aria-hidden="true">EST. 1984</div>
      </section>

      <section id="plan-finder" className="finder-shell page-width" aria-label="Find your weekly plan" data-reveal>
        <div className="finder-heading">
          <span className="finder-icon">W</span>
          <div>
            <p className="eyebrow">Weekly planner</p>
            <h2>Find your class plan</h2>
          </div>
        </div>
        <div className="finder-fields">
          <label>
            <span>Grade</span>
            <select defaultValue="">
              <option value="" disabled>Select grade</option>
              <option>Grade 1</option><option>Grade 2</option><option>Grade 3</option>
              <option>Grade 4</option><option>Grade 5</option><option>Grade 6</option>
            </select>
          </label>
          <label>
            <span>Class</span>
            <select defaultValue="">
              <option value="" disabled>Select class</option>
              <option>Class A</option><option>Class B</option><option>Class C</option>
            </select>
          </label>
          <label className="week-field">
            <span>School week</span>
            <select defaultValue="week-3">
              <option value="week-3">Week 3 · 20–24 September</option>
              <option value="week-4">Week 4 · 27 Sep–1 Oct</option>
            </select>
          </label>
          <Link href="/weekly-plan" className="button button-primary finder-button">View plan <span>→</span></Link>
        </div>
      </section>

      <section id="how-it-works" className="experience-section page-width" data-reveal>
        <div className="section-intro">
          <p className="eyebrow">Designed around families</p>
          <h2>School planning that feels effortless.</h2>
          <p className="section-copy">A calm, reliable view of the week—on any screen, at any time.</p>
        </div>
        <div className="feature-grid">
          {features.map((feature) => (
            <article className="feature-item" key={feature.number}>
              <span className="feature-number">{feature.number}</span>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="preview-section" data-reveal>
        <div className="page-width preview-grid">
          <div className="preview-copy">
            <p className="eyebrow light">A week at a glance</p>
            <h2>From Sunday to Thursday, nothing gets missed.</h2>
            <p>Each subject appears in its own row, with classwork, homework, and notes kept clear and easy to scan.</p>
            <Link className="text-link" href="/weekly-plan">Explore the full weekly plan <span>→</span></Link>
          </div>
          <div className="mini-plan" aria-label="Sample weekly plan preview">
            <div className="mini-plan-head"><span>WEEK 03</span><strong>Grade 4 · Class A</strong></div>
            <div className="mini-row mini-labels"><span>DAY</span><span>COURSE</span><span>HOMEWORK</span></div>
            <div className="mini-row"><span>Sunday</span><strong>English</strong><span>Workbook p. 9</span></div>
            <div className="mini-row"><span></span><strong>Mathematics</strong><span>Worksheet 2A</span></div>
            <div className="mini-row"><span>Monday</span><strong>Science</strong><span>Life cycle diagram</span></div>
            <div className="mini-row"><span></span><strong>Arabic</strong><span>Book activity</span></div>
            <div className="mini-plan-foot"><span>Teacher updated</span><span>Print-ready PDF</span></div>
          </div>
        </div>
      </section>

      <section className="teacher-banner page-width" data-reveal>
        <div>
          <p className="eyebrow">For families</p>
          <h2>Everything your child needs for the week.</h2>
          <p>Open the approved school plan from any device, then save or print a copy whenever you need it.</p>
        </div>
        <Link className="button button-dark" href="/weekly-plan">View this week’s plan <span>→</span></Link>
      </section>

      <footer className="site-footer" data-reveal>
        <div className="page-width footer-grid">
          <div className="footer-brand">
            <img src={`${basePath}/school-logo.jpeg`} alt="" />
            <div><strong>ALANDALUS PRIVATE SCHOOLS</strong><span>Egyptian Section</span></div>
          </div>
          <p>Weekly Study Plan · Academic Year 2026–2027</p>
          <Link href="/weekly-plan">View weekly plan</Link>
        </div>
      </footer>
      <Link className="whatsapp-support" href="/support" aria-label="Open technical support"><span>WA</span><b>Support</b></Link>
    </HomeReveal>
  );
}
