"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function SupportPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [issue, setIssue] = useState("");
  const [category, setCategory] = useState("Website issue");

  const submitSupport = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = `AlAndalus Technical Support\n\nName: ${name}\nContact: ${contact}\nCategory: ${category}\n\nProblem:\n${issue}`;
    window.location.href = `https://wa.me/966552019074?text=${encodeURIComponent(message)}`;
  };

  return <main className="support-page">
    <header className="support-header"><Link href="/" className="brand-lockup"><img src={`${basePath}/school-logo.jpeg`} alt="AlAndalus Private Schools" /><span className="brand-copy"><strong>ALANDALUS PRIVATE SCHOOLS</strong><small>Egyptian Section</small></span></Link><Link className="button button-outline" href="/">Back to Home</Link></header>
    <section className="support-hero"><div><p>HELP DESK</p><h1>Technical Support</h1><span>Tell us what happened and send your message directly to the school support team on WhatsApp.</span></div><span className="support-mark">WA</span></section>
    <section className="support-layout"><aside className="support-info"><h2>We are here to help.</h2><p>Use this form for website access, weekly plan, account or technical issues.</p><div><span>01</span><p><strong>Describe the issue</strong><small>Include the page and what you were trying to do.</small></p></div><div><span>02</span><p><strong>Send to WhatsApp</strong><small>Your message opens ready to send to school support.</small></p></div></aside><form className="support-form" onSubmit={submitSupport}><div><p className="eyebrow">SUPPORT REQUEST</p><h2>How can we help?</h2></div><label>Your Name<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter your name" /></label><label>Phone Number or Email<input required value={contact} onChange={(event) => setContact(event.target.value)} placeholder="Enter your phone number or email" /></label><label>Issue Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option>Website issue</option><option>Weekly plan issue</option><option>Account issue</option><option>Other technical issue</option></select></label><label>Describe the Problem<textarea required rows={6} value={issue} onChange={(event) => setIssue(event.target.value)} placeholder="Write the details of the problem here" /></label><div className="support-whatsapp-notice"><span>WA</span><p><strong>What happens next?</strong><small>After you press the button, WhatsApp opens with your message ready. Press Send in WhatsApp to deliver it to school support.</small></p></div><button className="button button-primary support-send" type="submit"><span>WA</span>Send via WhatsApp</button><small className="support-note">Your message is sent to the school support number: 00966552019074.</small></form></section>
  </main>;
}
