import PDFDocument from "pdfkit";
import Transaction from "../models/Transaction.js";
import Budget from "../models/Budget.js";
import User from "../models/User.js";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

// Theme Accent Color Map (Matches App's Active Accent Theme)
const THEME_ACCENTS = {
  emerald: "#10B981",
  cyber_mint: "#00F5A0",
  forest_green: "#15803D",
  lime_accent: "#84CC16",
  teal_glow: "#14B8A6",
  default: "#00F5A0", // Modern Neon Mint/Green
};

const getCurrencySymbol = (userCurrency) => {
  if (!userCurrency) return "Rs.";
  
  const curr = userCurrency.trim().toUpperCase();
  
  switch (curr) {
    case "USD":
    case "$":
      return "$";
    case "EUR":
    case "€":
      return "EUR";
    case "GBP":
    case "£":
      return "GBP";
    case "INR":
    case "₹":
      return "INR";
    case "PKR":
    case "RS":
    case "RS.":
      return "Rs.";
    default:
      return userCurrency;
  }
};

export const generateReport = async (req, res) => {
  try {
    const userId = req.user._id;

    const userDoc = await User.findById(userId);
    const currencySymbol = getCurrencySymbol(userDoc?.currency || req.user?.currency);

    // Extract Theme from Query or User Document
    const selectedThemeKey = req.query.theme || userDoc?.accentTheme || "default";
    const ACCENT_COLOR = THEME_ACCENTS[selectedThemeKey] || THEME_ACCENTS.default;

    let { startMonth, startYear, endMonth, endYear } = req.query;

    const sMonth = startMonth ? parseInt(startMonth, 10) : new Date().getMonth() + 1;
    const sYear = startYear ? parseInt(startYear, 10) : new Date().getFullYear();
    const eMonth = endMonth ? parseInt(endMonth, 10) : sMonth;
    const eYear = endYear ? parseInt(endYear, 10) : sYear;

    const startDate = new Date(sYear, sMonth - 1, 1);
    const endDate = new Date(eYear, eMonth, 0, 23, 59, 59, 999);

    const periodLabel = `${MONTH_NAMES[sMonth - 1]} ${sYear} - ${MONTH_NAMES[eMonth - 1]} ${eYear}`;

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

    // ⚡ Socket Notification Emit (With Updated App Name 'Walletly')
    const io = req.app.get("io");
    if (io) {
      io.to(userId.toString()).emit("new_notification", {
        title: "Report Downloaded 📄",
        message: `Your Walletly financial report (${periodLabel}) has been generated.`,
        type: "info",
        createdAt: new Date(),
      });
    }

    const doc = new PDFDocument({ margin: 40, size: "A4", bufferPages: true });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Walletly_Report_${sMonth}_${sYear}_to_${eMonth}_${eYear}.pdf`
    );

    doc.pipe(res);

    // Modern Dark Theme Palette
    const BG_DARK = "#090A0F";        // Base Page Black
    const CARD_BG = "#12151E";        // Surface Card Dark Slate
    const BORDER_DARK = "#222736";    // Muted Subtle Border
    const TEXT_LIGHT = "#FFFFFF";     // Primary High Contrast White
    const TEXT_MUTED = "#8E9BB0";     // Secondary Gray Text
    const SUCCESS_COLOR = "#10B981";  // Emerald Green
    const DANGER_COLOR = "#FF4D4D";   // Crimson Red
    const SAVINGS_COLOR = "#3B82F6";  // Vibrant Blue

    // Draw Dark Background for Whole Document Page
    const drawPageBackground = () => {
      doc.rect(0, 0, 595.28, 841.89).fill(BG_DARK);
    };

    drawPageBackground();

    // Top Glowing Accent Line
    doc.rect(0, 0, 595.28, 6).fill(ACCENT_COLOR);

    // Branding: Walletly Header
    doc
      .fillColor(ACCENT_COLOR)
      .fontSize(24)
      .font("Helvetica-Bold")
      .text("Walletly", 40, 32);

    doc
      .fillColor(TEXT_MUTED)
      .fontSize(8.5)
      .font("Helvetica-Bold")
      .text("EXECUTIVE FINANCIAL STATEMENT", 40, 60);

    const dateStr = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    doc
      .fillColor(TEXT_LIGHT)
      .fontSize(9.5)
      .font("Helvetica-Bold")
      .text(`Period: ${periodLabel}`, 340, 35, { align: "right" });

    doc
      .fillColor(TEXT_MUTED)
      .fontSize(8)
      .font("Helvetica")
      .text(`Generated: ${dateStr}`, 340, 52, { align: "right" });

    // Divider
    doc
      .moveTo(40, 78)
      .lineTo(555, 78)
      .strokeColor(BORDER_DARK)
      .lineWidth(1)
      .stroke();

    // Account Details
    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .fillColor(ACCENT_COLOR)
      .text("ACCOUNT SUMMARY", 40, 92);

    doc
      .fontSize(8.5)
      .font("Helvetica")
      .fillColor(TEXT_MUTED)
      .text("Account Holder: ", 40, 108, { continued: true })
      .font("Helvetica-Bold")
      .fillColor(TEXT_LIGHT)
      .text(req.user?.name || "N/A", { continued: true })
      .font("Helvetica")
      .fillColor(TEXT_MUTED)
      .text("   |   Email: ", { continued: true })
      .font("Helvetica-Bold")
      .fillColor(TEXT_LIGHT)
      .text(req.user?.email || "N/A");

    // Summary Metric Cards
    const cardY = 130;
    const cardWidth = 118;
    const cardHeight = 54;
    const gap = 11;

    const metrics = [
      { label: "Total Income", value: `${currencySymbol} ${totalIncome.toLocaleString()}`, color: SUCCESS_COLOR },
      { label: "Total Expense", value: `${currencySymbol} ${totalExpense.toLocaleString()}`, color: DANGER_COLOR },
      { label: "Net Savings", value: `${currencySymbol} ${savings.toLocaleString()}`, color: SAVINGS_COLOR },
      { label: "Monthly Budget", value: `${currencySymbol} ${monthlyBudget.toLocaleString()}`, color: ACCENT_COLOR },
    ];

    metrics.forEach((m, index) => {
      const x = 40 + index * (cardWidth + gap);

      // Dark Surface Box
      doc
        .roundedRect(x, cardY, cardWidth, cardHeight, 6)
        .fillAndStroke(CARD_BG, BORDER_DARK);

      // Top Highlight Border Line
      doc.rect(x + 10, cardY, cardWidth - 20, 2).fill(m.color);

      doc
        .fillColor(TEXT_MUTED)
        .fontSize(7.5)
        .font("Helvetica-Bold")
        .text(m.label.toUpperCase(), x + 10, cardY + 12);

      doc
        .fillColor(m.color)
        .fontSize(10)
        .font("Helvetica-Bold")
        .text(m.value, x + 10, cardY + 28);
    });

    // Table Header Drawing Helper
    const drawTableHeader = (y) => {
      doc.roundedRect(40, y, 515, 22, 4).fill("#161924");
      doc.fillColor(ACCENT_COLOR).fontSize(8.5).font("Helvetica-Bold");

      doc.text("TITLE", 50, y + 6);
      doc.text("CATEGORY", 190, y + 6);
      doc.text("DATE", 310, y + 6);
      doc.text("TYPE", 390, y + 6);
      doc.text("AMOUNT", 460, y + 6, { align: "right", width: 85 });
    };

    let tableTop = 202;

    doc
      .fillColor(TEXT_LIGHT)
      .fontSize(10.5)
      .font("Helvetica-Bold")
      .text(`TRANSACTION LOG (${transactions.length})`, 40, tableTop);

    tableTop += 18;
    drawTableHeader(tableTop);

    let yPos = tableTop + 24;

    if (transactions.length === 0) {
      doc
        .fillColor(TEXT_MUTED)
        .fontSize(9)
        .font("Helvetica")
        .text("No transactions recorded for this selected period.", 50, yPos + 10);
    } else {
      transactions.forEach((item, index) => {
        if (yPos > 730) {
          doc.addPage();
          drawPageBackground();
          yPos = 40;
          drawTableHeader(yPos);
          yPos += 24;
        }

        // Alternating Striped Rows
        if (index % 2 === 0) {
          doc.rect(40, yPos - 3, 515, 20).fill("#0D0E14");
        }

        const isIncome = item.type === "income";
        const amountColor = isIncome ? SUCCESS_COLOR : DANGER_COLOR;
        const amountSign = isIncome ? "+ " : "- ";

        const itemDate = item.date
          ? new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })
          : "N/A";

        doc
          .fillColor(TEXT_LIGHT)
          .fontSize(8.5)
          .font("Helvetica")
          .text(item.title || "N/A", 50, yPos, { width: 130, height: 12 });

        doc.fillColor(TEXT_LIGHT).text(item.category || "General", 190, yPos, { width: 110 });
        doc.fillColor(TEXT_MUTED).text(itemDate, 310, yPos, { width: 70 });
        doc.fillColor(TEXT_MUTED).text(item.type ? item.type.toUpperCase() : "N/A", 390, yPos);

        doc
          .fillColor(amountColor)
          .font("Helvetica-Bold")
          .text(`${amountSign}${currencySymbol} ${Number(item.amount).toLocaleString()}`, 460, yPos, {
            align: "right",
            width: 85,
          });

        yPos += 20;

        // Subtle Row Separator
        doc
          .moveTo(40, yPos - 2)
          .lineTo(555, yPos - 2)
          .strokeColor("#171A26")
          .lineWidth(0.5)
          .stroke();
      });
    }

    // Page Footer (Loop through buffered pages)
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);

      doc.moveTo(40, 770).lineTo(555, 770).strokeColor(BORDER_DARK).lineWidth(0.5).stroke();

      doc
        .fillColor(TEXT_MUTED)
        .fontSize(7.5)
        .font("Helvetica")
        .text("This is an official computer-generated statement from Walletly.", 40, 778);

      doc
        .fillColor(TEXT_MUTED)
        .fontSize(7.5)
        .font("Helvetica")
        .text(`Page ${i + 1} of ${range.count}`, 450, 778, { align: "right", width: 105 });
    }

    doc.end();
  } catch (error) {
    console.error("PDF Generation Error:", error);
    res.status(500).json({ message: "Failed to generate Walletly report PDF" });
  }
};