import { jsPDF } from "jspdf";

export async function imageToPdfBlob(
  imageUrl: string,
  title?: string,
): Promise<Blob> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error("Failed to fetch image");

  const blob = await res.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = dataUrl;
  });

  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;

  const orientation = imgH > imgW ? "portrait" : "landscape";
  const pdf = new jsPDF({
    orientation,
    unit: "px",
    format: [imgW, imgH],
    hotfixes: ["px_scaling"],
  });

  if (title) {
    pdf.setProperties({ title });
  }

  const format = blob.type === "image/jpeg" ? "JPEG" : "PNG";
  pdf.addImage(dataUrl, format, 0, 0, imgW, imgH);

  return pdf.output("blob");
}
