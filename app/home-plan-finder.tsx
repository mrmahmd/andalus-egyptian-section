import Link from "next/link";

export default function HomePlanFinder() {
  return (
    <section id="plan-finder" className="finder-shell page-width" aria-label="Find your weekly plan" data-reveal>
      <div className="finder-heading"><span className="finder-icon">W</span><div><p className="eyebrow">Weekly planner</p><h2>Find your class plan</h2></div></div>
      <div className="finder-fields">
        <p className="section-copy">Choose your child’s grade, class and any available school week from the plan library.</p>
        <Link href="/weekly-plan" className="button button-primary finder-button">Browse weekly plans <span>→</span></Link>
      </div>
    </section>
  );
}
