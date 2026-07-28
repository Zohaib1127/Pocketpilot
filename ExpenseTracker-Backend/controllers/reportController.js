import PDFDocument from "pdfkit";
import Transaction from "../models/Transaction.js";
import Budget from "../models/Budget.js";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export const generateReport = async (req, res) => {
  try {
    const userId = req.user._id;

    // 🗓️ Extract Start & End Period Params
    let { startMonth, startYear, endMonth, endYear } = req.query;

    const sMonth = startMonth ? parseInt(startMonth, 10) : new Date().getMonth() + 1;
    const sYear = startYear ? parseInt(startYear, 10) : new Date().getFullYear();
    const eMonth = endMonth ? parseInt(endMonth, 10) : sMonth;
    const eYear = endYear ? parseInt(endYear, 10) : sYear;

    // Period Start & End Dates
    const startDate = new Date(sYear, sMonth - 1, 1);
    const endDate = new Date(eYear, eMonth, 0, 23, 59, 59, 999);

    const periodLabel = `${MONTH_NAMES[sMonth - 1]} ${sYear} - ${MONTH_NAMES[eMonth - 1]} ${eYear}`;

    // Fetch transactions & budget within selected range
    const transactions = await Transaction.find({
      user: userId,
      date: { $gte: startDate, $lte: endDate },
    }).sort({ date: -1 });

    const userBudget = await Budget.findOne({ user: userId });

    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach((item) => {
      if (item.type === "income") {
        totalIncome += Number(item.amount) || 0;
      } else if (item.type === "expense") {
        totalExpense += Number(item.amount) || 0;
      }
    });

    const savings = totalIncome - totalExpense;
    const monthlyBudget = userBudget?.amount || 0;

    // ⚡ Socket Notification Emit
    const io = req.app.get("io");
    if (io) {
      io.to(userId.toString()).emit("new_notification", {
        title: "Report Downloaded 📄",
        message: `Your report for (${periodLabel}) has been generated successfully.`,
        createdAt: new Date(),
      });
    }

    // Setup PDF
    const doc = new PDFDocument({ margin: 40, size: "A4", bufferPages: true });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Expense_Report_${sMonth}_${sYear}_to_${eMonth}_${eYear}.pdf`
    );

    doc.pipe(res);

    // Color Palette
    const PRIMARY_COLOR = "#4F46E5";
    const SECONDARY_BG = "#EEF2FF";
    const TEXT_MAIN = "#0F172A";
    const TEXT_MUTED = "#64748B";
    const SUCCESS_COLOR = "#10B981";
    const DANGER_COLOR = "#EF4444";
    const SAVINGS_COLOR = "#0284C7";
    const CARD_BG = "#F8FAFC";
    const BORDER_COLOR = "#E2E8F0";

    // Header
    doc.rect(0, 0, 595.28, 12).fill(PRIMARY_COLOR);

    doc
      .fillColor(PRIMARY_COLOR)
      .fontSize(24)
      .font("Helvetica-Bold")
      .text("PocketPilot", 40, 35);

    doc
      .fillColor(TEXT_MUTED)
      .fontSize(9)
      .font("Helvetica-Bold")
      .text("FINANCIAL STATEMENT", 40, 63);

    const dateStr = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    doc
      .fillColor(TEXT_MAIN)
      .fontSize(10)
      .font("Helvetica-Bold")
      .text(`Period: ${periodLabel}`, 340, 38, { align: "right" });

    doc
      .fillColor(TEXT_MUTED)
      .fontSize(8)
      .font("Helvetica")
      .text(`Generated: ${dateStr}`, 340, 55, { align: "right" });

    doc
      .moveTo(40, 80)
      .lineTo(555, 80)
      .strokeColor(BORDER_COLOR)
      .lineWidth(1)
      .stroke();

    // User Profile
    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .fillColor(TEXT_MAIN)
      .text("ACCOUNT INFORMATION", 40, 95);

    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor(TEXT_MUTED)
      .text("Account Holder: ", 40, 112, { continued: true })
      .font("Helvetica-Bold")
      .fillColor(TEXT_MAIN)
      .text(req.user?.name || "N/A", { continued: true })
      .font("Helvetica")
      .fillColor(TEXT_MUTED)
      .text("   |   Email: ", { continued: true })
      .font("Helvetica-Bold")
      .fillColor(TEXT_MAIN)
      .text(req.user?.email || "N/A");

    // Metric Cards Grid
    const cardY = 135;
    const cardWidth = 118;
    const cardHeight = 52;
    const gap = 11;

    const metrics = [
      { label: "Total Income", value: `Rs. ${totalIncome.toLocaleString()}`, color: SUCCESS_COLOR },
      { label: "Total Expense", value: `Rs. ${totalExpense.toLocaleString()}`, color: DANGER_COLOR },
      { label: "Net Savings", value: `Rs. ${savings.toLocaleString()}`, color: SAVINGS_COLOR },
      { label: "Monthly Budget", value: `Rs. ${monthlyBudget.toLocaleString()}`, color: TEXT_MAIN },
    ];

    metrics.forEach((m, index) => {
      const x = 40 + index * (cardWidth + gap);

      doc
        .roundedRect(x, cardY, cardWidth, cardHeight, 6)
        .fillAndStroke(CARD_BG, BORDER_COLOR);

      doc.rect(x + 10, cardY, cardWidth - 20, 2).fill(m.color);

      doc
        .fillColor(TEXT_MUTED)
        .fontSize(7.5)
        .font("Helvetica-Bold")
        .text(m.label.toUpperCase(), x + 10, cardY + 10);

      doc
        .fillColor(m.color)
        .fontSize(10)
        .font("Helvetica-Bold")
        .text(m.value, x + 10, cardY + 26);
    });

    // Table Header
    const drawTableHeader = (y) => {
      doc.rect(40, y, 515, 22).fill(SECONDARY_BG);
      doc.fillColor(PRIMARY_COLOR).fontSize(8.5).font("Helvetica-Bold");

      doc.text("TITLE", 50, y + 6);
      doc.text("CATEGORY", 190, y + 6);
      doc.text("DATE", 310, y + 6);
      doc.text("TYPE", 390, y + 6);
      doc.text("AMOUNT", 460, y + 6, { align: "right", width: 85 });
    };

    let tableTop = 205;

    doc
      .fillColor(TEXT_MAIN)
      .fontSize(11)
      .font("Helvetica-Bold")
      .text(`TRANSACTION HISTORY (${transactions.length})`, 40, tableTop);

    tableTop += 18;
    drawTableHeader(tableTop);

    let yPos = tableTop + 24;

    if (transactions.length === 0) {
      doc
        .fillColor(TEXT_MUTED)
        .fontSize(9.5)
        .font("Helvetica")
        .text("No transactions recorded for this period.", 50, yPos + 10);
    } else {
      transactions.forEach((item, index) => {
        if (yPos > 730) {
          doc.addPage();
          yPos = 40;
          drawTableHeader(yPos);
          yPos += 24;
        }

        if (index % 2 === 0) {
          doc.rect(40, yPos - 3, 515, 20).fill("#FAFAFA");
        }

        const isIncome = item.type === "income";
        const amountColor = isIncome ? SUCCESS_COLOR : DANGER_COLOR;
        const amountSign = isIncome ? "+ " : "- ";

        const itemDate = item.date
          ? new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })
          : "N/A";

        doc
          .fillColor(TEXT_MAIN)
          .fontSize(8.5)
          .font("Helvetica")
          .text(item.title || "N/A", 50, yPos, { width: 130, height: 12 });

        doc.fillColor(TEXT_MAIN).text(item.category || "General", 190, yPos, { width: 110 });
        doc.fillColor(TEXT_MUTED).text(itemDate, 310, yPos, { width: 70 });
        doc.fillColor(TEXT_MUTED).text(item.type ? item.type.toUpperCase() : "N/A", 390, yPos);

        doc
          .fillColor(amountColor)
          .font("Helvetica-Bold")
          .text(`${amountSign}Rs. ${Number(item.amount).toLocaleString()}`, 460, yPos, {
            align: "right",
            width: 85,
          });

        yPos += 20;

        doc
          .moveTo(40, yPos - 2)
          .lineTo(555, yPos - 2)
          .strokeColor("#F1F5F9")
          .lineWidth(0.5)
          .stroke();
      });
    }

    // Dynamic Footer
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);

      doc.moveTo(40, 770).lineTo(555, 770).strokeColor(BORDER_COLOR).lineWidth(0.5).stroke();

      doc
        .fillColor(TEXT_MUTED)
        .fontSize(7.5)
        .font("Helvetica")
        .text("This is a computer-generated statement from PocketPilot. No signature required.", 40, 778);

      doc
        .fillColor(TEXT_MUTED)
        .fontSize(7.5)
        .font("Helvetica")
        .text(`Page ${i + 1} of ${range.count}`, 450, 778, { align: "right", width: 105 });
    }

    doc.end();
  } catch (error) {
    console.error("PDF Generation Error:", error);
    res.status(500).json({ message: "Failed to generate report PDF" });
  }
};