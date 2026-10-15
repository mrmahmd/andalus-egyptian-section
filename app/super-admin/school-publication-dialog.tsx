"use client";

export type PublicationNotice = { title: string; message: string; tone: "success" | "info" | "error"; details?: string[] };
export default function SchoolPublicationDialog({ notice, onClose }: { notice: PublicationNotice; onClose: () => void }) {
  const arabic = /^[\u0600-\u06ff]/.test(notice.title);
  return <div className="weekly-send-confirmation-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="weekly-send-confirmation" role="alertdialog" aria-modal="true" aria-labelledby="school-publication-result-title" dir={arabic ? "rtl" : "ltr"} style={{borderTop:`5px solid ${notice.tone === "success" ? "#17a486" : notice.tone === "error" ? "#d94c68" : "#1288a0"}`}}>
      <span aria-hidden="true">{notice.tone === "success" ? "✓" : notice.tone === "error" ? "!" : "i"}</span>
      <h3 id="school-publication-result-title">{notice.title}</h3><p>{notice.message}</p>
      {notice.details?.length ? <ul style={{maxHeight:180,overflowY:"auto",textAlign:"start"}}>{notice.details.map((detail,index) => <li key={index}>{detail}</li>)}</ul> : null}
      <div><button autoFocus type="button" className="teacher-primary-button" onClick={onClose}>{arabic ? "حسنًا" : "OK"}</button></div>
    </section>
  </div>;
}
