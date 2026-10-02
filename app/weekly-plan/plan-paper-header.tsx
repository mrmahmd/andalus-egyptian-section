export default function PlanPaperHeader({ basePath }: { basePath: string }) {
  return <div className="paper-header">
    <img className="paper-school-logo" src={`${basePath}/school-logo.png`} alt="AlAndalus Private Schools" />
    <div>
      <strong>ALANDALUS PRIVATE SCHOOLS</strong>
      <span>The Egyptian Section</span>
      <h2>WEEKLY STUDY PLAN</h2>
    </div>
    <img className="paper-accreditation-logo" src={`${basePath}/cognia-accredited-transparent.png`} alt="Cognia Accredited" />
  </div>;
}
