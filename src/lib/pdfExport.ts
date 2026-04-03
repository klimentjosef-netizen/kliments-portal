import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

export async function exportCfoPdf(elementId: string, title: string) {
  const element = document.getElementById(elementId)
  if (!element) return

  // Temporarily add print-friendly styles
  element.classList.add('pdf-export')

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#faf4ed', // sand background
    logging: false,
  })

  element.classList.remove('pdf-export')

  const imgData = canvas.toDataURL('image/png')
  const imgWidth = 210 // A4 width in mm
  const pageHeight = 297 // A4 height in mm
  const imgHeight = (canvas.height * imgWidth) / canvas.width

  const pdf = new jsPDF('p', 'mm', 'a4')

  // Add title header
  pdf.setFontSize(8)
  pdf.setTextColor(150, 150, 150)
  pdf.text(`Kliments · ${title} · ${new Date().toLocaleDateString('cs-CZ')}`, 10, 8)

  let heightLeft = imgHeight
  let position = 12 // start below header

  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
  heightLeft -= (pageHeight - position)

  // Add pages if content overflows
  while (heightLeft > 0) {
    position = heightLeft - imgHeight
    pdf.addPage()
    pdf.setFontSize(8)
    pdf.setTextColor(150, 150, 150)
    pdf.text(`Kliments · ${title}`, 10, 8)
    pdf.addImage(imgData, 'PNG', 0, position + 12, imgWidth, imgHeight)
    heightLeft -= pageHeight
  }

  pdf.save(`${title.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`)
}
