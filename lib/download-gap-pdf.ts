import type { GapGroup } from "./weekly-gap-report";

// Canvas keeps the browser's Arabic shaping and the school's font in exported PDFs.
// Each A4 page is embedded at 200 dpi; no staff data leaves the browser.
export async function downloadGapPdf(report: { title: string; week: string; groups: GapGroup[]; columns: string[]; arabic: boolean; logoUrl: string; generatedAt: string }) {
  await document.fonts.ready;
  await document.fonts.load('700 24px Alexandria');
  const logo = new Image(); logo.src = report.logoUrl;
  await logo.decode();
  const width = 1654, height = 2339, margin = 90, bottom = height - 110;
  const pages: HTMLCanvasElement[] = [];
  let canvas: HTMLCanvasElement;
  let ctx!: CanvasRenderingContext2D;
  let y = 0;
  let currentPerson = "";
  let currentCount = 0;
  const font = (size: number, bold = false) => { ctx.font = `${bold ? 700 : 400} ${size}px ${report.arabic ? "Alexandria, Cairo" : "Arial"}`; ctx.direction = report.arabic ? "rtl" : "ltr"; ctx.textAlign = report.arabic ? "right" : "left"; };
  const lines = (text: string, maxWidth: number) => {
    const result: string[] = []; let line = "";
    for (const word of text.split(/\s+/)) { const next = line ? `${line} ${word}` : word; if (ctx.measureText(next).width > maxWidth && line) { result.push(line); line = word; } else line = next; }
    result.push(line); return result;
  };
  const text = (value: string, top: number, size: number, color = "#183959", bold = false) => { font(size,bold); ctx.fillStyle=color; const wrapped=lines(value,width-margin*2-36); wrapped.forEach((line,i)=>ctx.fillText(line, report.arabic ? width-margin-18 : margin+18,top+i*(size*1.7))); return wrapped.length*size*1.7; };
  const newPage = () => {
    canvas=document.createElement("canvas"); canvas.width=width; canvas.height=height; ctx=canvas.getContext("2d")!; pages.push(canvas);
    ctx.fillStyle="#fff"; ctx.fillRect(0,0,width,height); ctx.fillStyle="#163a63"; ctx.fillRect(0,0,width,14);
    ctx.fillStyle="#edf6fa"; ctx.fillRect(margin,35,width-2*margin,235);
    const logoX=report.arabic ? margin+20 : width-margin-165;
    ctx.fillStyle="#fff";ctx.fillRect(logoX,55,145,155);
    const logoScale=Math.min(125/logo.naturalWidth,135/logo.naturalHeight);
    ctx.drawImage(logo,logoX+(145-logo.naturalWidth*logoScale)/2,65+(135-logo.naturalHeight*logoScale)/2,logo.naturalWidth*logoScale,logo.naturalHeight*logoScale);
    text(report.arabic ? "مدارس الأندلس الأهلية · المسار المصري" : "AlAndalus Private Schools · Egyptian Section",75,26,"#176779",true);
    text(report.title,139,38,"#153654",true); text(report.week,204,25); text(`${report.arabic ? "وقت استخراج التقرير" : "Generated"}: ${report.generatedAt}`,251,21,"#63788e");
    ctx.strokeStyle="#d5e2eb"; ctx.beginPath();ctx.moveTo(margin,280);ctx.lineTo(width-margin,280);ctx.stroke(); y=320;
    if (currentPerson) personHeading();
  };
  const ensure = (required: number) => { if(y+required>bottom)newPage(); };
  const personHeading = () => {
    font(38,true);const wrapped=lines(`${currentPerson} · ${currentCount} ${report.arabic ? "بنود متابعة" : "follow-up items"}`,width-2*margin-48);const h=wrapped.length*60+32;
    const gradient=ctx.createLinearGradient(margin,0,width-margin,0);gradient.addColorStop(0,"#176779");gradient.addColorStop(1,"#163a63");ctx.fillStyle=gradient;ctx.fillRect(margin,y,width-2*margin,h);
    ctx.fillStyle="#fff";wrapped.forEach((line,i)=>ctx.fillText(line,report.arabic?width-margin-24:margin+24,y+57+i*60));y+=h+20;
  };
  const ratios=report.columns[0]==="اليوم"||report.columns[0]==="Day"?[.15,.19,.13,.53]:[.24,.16,.25,.35];
  const tableRow = (cells: string[], tone: "red"|"orange"|"blue"|"header", draw: boolean) => {
    font(tone==="header"?28:31,tone==="header");
    const widths=ratios.map(r=>r*(width-2*margin));const wrapped=cells.map((cell,i)=>lines(cell,widths[i]-32));
    const rowHeight=Math.max(...wrapped.map(row=>row.length))*53+32;
    if(draw) {let x=report.arabic?width-margin:margin;
      for(let i=0;i<cells.length;i++) {const w=widths[i];if(report.arabic)x-=w;
        const shades=tone==="red"?["#fff0f3","#ffe3ea"]:tone==="orange"?["#fff4e2","#ffe8c5"]:["#eef5ff","#dfeaff"];
        ctx.fillStyle=tone==="header"?"#244b6a":shades[i%2];ctx.fillRect(x,y,w,rowHeight);
        ctx.strokeStyle=tone==="header"?"#6085a0":"#c4d5e3";ctx.lineWidth=2;ctx.strokeRect(x,y,w,rowHeight);
        ctx.fillStyle=tone==="header"?"#fff":tone==="red"?"#9a2545":tone==="orange"?"#805016":"#244c7a";
        wrapped[i].forEach((line,j)=>ctx.fillText(line,report.arabic?x+w-16:x+16,y+48+j*53));if(!report.arabic)x+=w;
      }
      y+=rowHeight;
    }return rowHeight;
  };
  const blockHeading=(title:string)=>{font(30,true);const h=lines(title,width-2*margin-36).length*51+25;ctx.fillStyle="#e5f0f4";ctx.fillRect(margin,y,width-2*margin,h);text(title,y+44,30,"#173957",true);y+=h;tableRow(report.columns,"header",true);};
  newPage();
  text(`${report.groups.length} ${report.arabic ? "أسماء تحتاج متابعة" : "people needing follow-up"} · ${report.groups.reduce((sum,g)=>sum+g.count,0)} ${report.arabic ? "بنود متابعة" : "follow-up items"}`,y,26,"#176779",true); y+=65;
  for(const group of report.groups) {
    if(y+430>bottom){currentPerson="";newPage();}currentPerson=group.name;currentCount=group.count;personHeading();
    for(const block of group.blocks) {
      ensure(300);blockHeading(block.title);
      for(const row of block.rows) {
        const rowHeight=tableRow(row.cells,row.tone,false);
        if(y+rowHeight>bottom) {newPage();blockHeading(block.title);}
        tableRow(row.cells,row.tone,true);
      } y+=20;
    } y+=20;
  }
  const encoder=new TextEncoder(); const chunks: Uint8Array[]=[]; let length=0; const offsets=[0]; const write=(value:string|Uint8Array)=>{const bytes=typeof value==="string"?encoder.encode(value):value;chunks.push(bytes);length+=bytes.length;};
  const object=(id:number,body:string|(()=>void))=>{offsets[id]=length;write(`${id} 0 obj\n`);if(typeof body==="string")write(body);else body();write("\nendobj\n");};
  write("%PDF-1.4\n");object(1,"<< /Type /Catalog /Pages 2 0 R >>");object(2,`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_,i)=>`${3+i*3} 0 R`).join(" ")}] >>`);
  for(let i=0;i<pages.length;i++) {
    const page=pages[i];const pageCtx=page.getContext("2d")!;pageCtx.font="22px Arial";pageCtx.direction="ltr";pageCtx.fillStyle="#738296";pageCtx.textAlign="center";pageCtx.fillText(`${i+1} / ${pages.length}`,width/2,height-55);
    const jpeg=await new Promise<Blob>((resolve,reject)=>page.toBlob(blob=>blob?resolve(blob):reject(new Error("PDF image encoding failed")),"image/jpeg",.94)); const bytes=new Uint8Array(await jpeg.arrayBuffer());const id=3+i*3;const stream="q 595.28 0 0 841.89 0 0 cm /Im0 Do Q";
    object(id,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${id+1} 0 R >> >> /Contents ${id+2} 0 R >>`);
    object(id+1,()=>{write(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`);write(bytes);write("\nendstream");});
    object(id+2,`<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}\nendstream`);
  }
  const start=length;write(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);for(const offset of offsets.slice(1))write(`${String(offset).padStart(10,"0")} 00000 n \n`);write(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`);
  const blob=new Blob(chunks as BlobPart[],{type:"application/pdf"});const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download=`weekly-gaps-${new Date().toISOString().slice(0,10)}.pdf`;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
