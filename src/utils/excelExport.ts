import ExcelJS from 'exceljs';

// Color palette for professional styling
const COLORS = {
  headerBg: '4472C4',      // Professional blue
  headerText: 'FFFFFF',    // White
  titleBg: '2F5496',       // Darker blue for titles
  altRowBg: 'F2F2F2',      // Light gray for alternating rows
  successBg: 'C6EFCE',     // Light green
  successText: '006100',   // Dark green
  warningBg: 'FFEB9C',     // Light yellow
  warningText: '9C5700',   // Dark yellow/orange
  errorBg: 'FFC7CE',       // Light red
  errorText: '9C0006',     // Dark red
  border: 'D9D9D9',        // Light gray border
  darkBorder: 'B4B4B4',    // Darker border
};

// Font definitions
const FONTS = {
  title: { name: 'Calibri', size: 16, bold: true, color: { argb: COLORS.headerText } },
  header: { name: 'Calibri', size: 11, bold: true, color: { argb: COLORS.headerText } },
  normal: { name: 'Calibri', size: 10 },
  bold: { name: 'Calibri', size: 10, bold: true },
};

// Border styles
const BORDERS = {
  thin: {
    top: { style: 'thin' as const, color: { argb: COLORS.border } },
    left: { style: 'thin' as const, color: { argb: COLORS.border } },
    bottom: { style: 'thin' as const, color: { argb: COLORS.border } },
    right: { style: 'thin' as const, color: { argb: COLORS.border } },
  },
  medium: {
    top: { style: 'medium' as const, color: { argb: COLORS.darkBorder } },
    left: { style: 'medium' as const, color: { argb: COLORS.darkBorder } },
    bottom: { style: 'medium' as const, color: { argb: COLORS.darkBorder } },
    right: { style: 'medium' as const, color: { argb: COLORS.darkBorder } },
  },
};

// ExportOptions interface removed - not currently used

interface ColumnConfig {
  header: string;
  key: string;
  width?: number;
  style?: 'normal' | 'center' | 'number' | 'date' | 'status';
}

/**
 * Creates a styled workbook with common settings
 */
export function createStyledWorkbook(): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EventHub';
  workbook.created = new Date();
  workbook.modified = new Date();
  return workbook;
}

/**
 * Adds a styled worksheet with title and headers
 */
export function addStyledSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  options?: { title?: string; subtitle?: string }
): ExcelJS.Worksheet {
  const worksheet = workbook.addWorksheet(sheetName, {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
    views: [{ state: 'frozen', xSplit: 0, ySplit: options?.title ? 3 : 1 }],
  });

  let currentRow = 1;

  // Add title if provided
  if (options?.title) {
    const titleRow = worksheet.getRow(currentRow);
    titleRow.getCell(1).value = options.title;
    titleRow.getCell(1).font = FONTS.title;
    titleRow.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.titleBg },
    };
    titleRow.height = 30;
    currentRow++;

    // Add subtitle/timestamp
    const subtitleRow = worksheet.getRow(currentRow);
    subtitleRow.getCell(1).value = options.subtitle || `Generated: ${new Date().toLocaleString()}`;
    subtitleRow.getCell(1).font = { ...FONTS.normal, italic: true, color: { argb: '666666' } };
    subtitleRow.height = 20;
    currentRow++;
  }

  return worksheet;
}

/**
 * Style the header row
 */
export function styleHeaderRow(worksheet: ExcelJS.Worksheet, rowNumber: number, columnCount: number): void {
  const headerRow = worksheet.getRow(rowNumber);
  headerRow.height = 28;
  
  for (let col = 1; col <= columnCount; col++) {
    const cell = headerRow.getCell(col);
    cell.font = FONTS.header;
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.headerBg },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = BORDERS.medium;
  }
}

/**
 * Style data rows with alternating colors
 */
export function styleDataRows(
  worksheet: ExcelJS.Worksheet,
  startRow: number,
  endRow: number,
  columnCount: number
): void {
  for (let rowNum = startRow; rowNum <= endRow; rowNum++) {
    const row = worksheet.getRow(rowNum);
    row.height = 22;
    
    const isAltRow = (rowNum - startRow) % 2 === 1;
    
    for (let col = 1; col <= columnCount; col++) {
      const cell = row.getCell(col);
      cell.font = FONTS.normal;
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
      cell.border = BORDERS.thin;
      
      if (isAltRow) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: COLORS.altRowBg },
        };
      }
    }
  }
}

/**
 * Apply status-based styling to a cell
 */
export function styleStatusCell(cell: ExcelJS.Cell, status: string): void {
  const statusLower = status.toLowerCase();
  
  if (statusLower.includes('success') || statusLower.includes('approved') || statusLower.includes('confirmed') || statusLower.includes('attended')) {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.successBg },
    };
    cell.font = { ...FONTS.bold, color: { argb: COLORS.successText } };
  } else if (statusLower.includes('pending') || statusLower.includes('waiting')) {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.warningBg },
    };
    cell.font = { ...FONTS.bold, color: { argb: COLORS.warningText } };
  } else if (statusLower.includes('cancel') || statusLower.includes('reject') || statusLower.includes('fail')) {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.errorBg },
    };
    cell.font = { ...FONTS.bold, color: { argb: COLORS.errorText } };
  }
  
  cell.alignment = { vertical: 'middle', horizontal: 'center' };
}

/**
 * Auto-fit columns based on content
 */
export function autoFitColumns(worksheet: ExcelJS.Worksheet, minWidth = 10, maxWidth = 50): void {
  worksheet.columns.forEach((column) => {
    let maxLength = minWidth;
    
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const cellValue = cell.value?.toString() || '';
      const cellLength = cellValue.length;
      maxLength = Math.max(maxLength, Math.min(cellLength + 2, maxWidth));
    });
    
    column.width = maxLength;
  });
}

/**
 * Add a summary/footer row
 */
export function addSummaryRow(
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  label: string,
  value: string | number,
  columnCount: number
): void {
  const row = worksheet.getRow(rowNumber);
  row.height = 25;
  
  // Merge cells for label
  worksheet.mergeCells(rowNumber, 1, rowNumber, columnCount - 1);
  const labelCell = row.getCell(1);
  labelCell.value = label;
  labelCell.font = FONTS.bold;
  labelCell.alignment = { vertical: 'middle', horizontal: 'right' };
  labelCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'E7E6E6' },
  };
  
  // Value cell
  const valueCell = row.getCell(columnCount);
  valueCell.value = value;
  valueCell.font = { ...FONTS.bold, size: 12 };
  valueCell.alignment = { vertical: 'middle', horizontal: 'center' };
  valueCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: COLORS.headerBg },
  };
  valueCell.border = BORDERS.medium;
}

/**
 * Download the workbook as an Excel file
 * Uses base64 data URI to avoid "insecure download" blocking on HTTP sites
 */
export async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const finalFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  
  // Convert buffer to base64 data URI to bypass insecure download blocking
  const uint8Array = new Uint8Array(buffer as ArrayBuffer);
  let binary = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  const base64 = btoa(binary);
  const dataUri = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
  
  const link = document.createElement('a');
  link.href = dataUri;
  link.download = finalFilename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export participants data with full styling
 */
export async function exportParticipantsToExcel(
  participants: Array<{
    user: {
      regId?: string;
      name: string;
      department?: string;
      section?: string;
      roomNo?: string;
      role?: string;
      year?: number;
      email: string;
      mobile?: string;
    };
    registeredAt: string;
    status: string;
    approvalType?: string;
  }>,
  eventTitle: string
): Promise<void> {
  const workbook = createStyledWorkbook();
  
  const worksheet = addStyledSheet(workbook, 'Participants', {
    title: `📋 ${eventTitle} - Participants List`,
    subtitle: `Total Participants: ${participants.length} | Generated: ${new Date().toLocaleString()}`,
  });

  // Define columns
  const columns: ColumnConfig[] = [
    { header: 'S.No', key: 'sno', width: 8 },
    { header: 'Registration ID', key: 'regId', width: 18 },
    { header: 'Name', key: 'name', width: 25 },
    { header: 'Department', key: 'department', width: 15 },
    { header: 'Section/Room', key: 'section', width: 14 },
    { header: 'Year', key: 'year', width: 8 },
    { header: 'College', key: 'college', width: 30 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Mobile', key: 'mobile', width: 15 },
    { header: 'Registered At', key: 'registeredAt', width: 20 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Approval Type', key: 'approvalType', width: 18 },
  ];

  // Set column widths manually (don't use worksheet.columns with headers to avoid duplicate header row)
  columns.forEach((col, index) => {
    const column = worksheet.getColumn(index + 1);
    column.width = col.width;
    column.key = col.key;
  });

  // Merge title cells
  worksheet.mergeCells('A1:L1');
  worksheet.mergeCells('A2:L2');

  // Add header row at row 3
  const headerRowNumber = 3;
  const headerRow = worksheet.getRow(headerRowNumber);
  columns.forEach((col, index) => {
    headerRow.getCell(index + 1).value = col.header;
  });
  styleHeaderRow(worksheet, headerRowNumber, columns.length);

  // Add data rows starting at row 4
  const dataStartRow = 4;
  participants.forEach((participant, index) => {
    const row = worksheet.getRow(dataStartRow + index);
    
    const approvalTypeLabel = participant.approvalType === 'autoApproved'
      ? 'Auto Approved'
      : participant.approvalType === 'manualApproved'
        ? 'Manually Approved'
        : participant.approvalType === 'waitingListApproval'
          ? 'Waiting List'
          : '';

    row.values = [
      index + 1,
      participant.user.regId || 'N/A',
      participant.user.name,
      participant.user.department || 'N/A',
      (participant.user.role === 'faculty' ? (participant.user as any).roomNo : participant.user.section) || 'N/A',
      participant.user.year || 'N/A',
      (participant.user as any).college || 'N/A',
      participant.user.email,
      participant.user.mobile || 'N/A',
      new Date(participant.registeredAt).toLocaleString(),
      participant.status,
      approvalTypeLabel,
    ];
  });

  // Style data rows
  const dataEndRow = dataStartRow + participants.length - 1;
  styleDataRows(worksheet, dataStartRow, dataEndRow, columns.length);

  // Style status column
  for (let rowNum = dataStartRow; rowNum <= dataEndRow; rowNum++) {
    const statusCell = worksheet.getRow(rowNum).getCell(11); // Status column (shifted to 11 after adding college)
    styleStatusCell(statusCell, statusCell.value?.toString() || '');
  }

  // Add summary row
  addSummaryRow(worksheet, dataEndRow + 2, 'Total Participants:', participants.length, columns.length);

  // Download
  const filename = `${eventTitle.replace(/[^a-zA-Z0-9]/g, '_')}_participants.xlsx`;
  await downloadWorkbook(workbook, filename);
}

/**
 * Export sub-event attendees with styling
 */
export async function exportAttendeesToExcel(
  attendees: Array<{
    userId?: { name?: string; email?: string; department?: string; section?: string; roomNo?: string; year?: number; role?: string };
    user?: { name?: string; email?: string; department?: string; section?: string; roomNo?: string; year?: number; role?: string };
    registrationId: string;
    source?: string;
    status: string;
    registeredAt: string;
    scannedAt?: string;
  }>,
  subEventTitle: string
): Promise<void> {
  const workbook = createStyledWorkbook();
  
  const worksheet = addStyledSheet(workbook, 'Attendees', {
    title: `📋 ${subEventTitle} - Attendees List`,
    subtitle: `Total Attendees: ${attendees.length} | Generated: ${new Date().toLocaleString()}`,
  });

  const columns = [
    { header: 'S.No', key: 'sno', width: 8 },
    { header: 'Name', key: 'name', width: 25 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Department', key: 'department', width: 15 },
    { header: 'Section/Room', key: 'section', width: 14 },
    { header: 'Year', key: 'year', width: 8 },
    { header: 'College', key: 'college', width: 30 },
    { header: 'Role', key: 'role', width: 12 },
    { header: 'Registration ID', key: 'registrationId', width: 20 },
    { header: 'Source', key: 'source', width: 12 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Registered At', key: 'registeredAt', width: 20 },
    { header: 'Scanned At', key: 'scannedAt', width: 20 },
  ];

  // Set column widths manually (don't use worksheet.columns with headers to avoid duplicate header row)
  columns.forEach((col, index) => {
    const column = worksheet.getColumn(index + 1);
    column.width = col.width;
    column.key = col.key;
  });

  // Merge title cells
  worksheet.mergeCells('A1:M1');
  worksheet.mergeCells('A2:M2');

  const headerRowNumber = 3;
  const headerRow = worksheet.getRow(headerRowNumber);
  columns.forEach((col, index) => {
    headerRow.getCell(index + 1).value = col.header;
  });
  styleHeaderRow(worksheet, headerRowNumber, columns.length);

  const dataStartRow = 4;
  attendees.forEach((attendee, index) => {
    const row = worksheet.getRow(dataStartRow + index);
    const userInfo = attendee.userId || attendee.user;
    
    row.values = [
      index + 1,
      userInfo?.name || 'N/A',
      userInfo?.email || 'N/A',
      userInfo?.department || 'N/A',
      userInfo?.section || userInfo?.roomNo || 'N/A',
      userInfo?.year || 'N/A',
      (userInfo as any)?.college || 'N/A',
      userInfo?.role || 'N/A',
      attendee.registrationId,
      attendee.source === 'waitlist' ? 'Waitlist' : 'Direct',
      attendee.status,
      new Date(attendee.registeredAt).toLocaleString(),
      attendee.scannedAt ? new Date(attendee.scannedAt).toLocaleString() : 'Not Scanned',
    ];
  });

  const dataEndRow = dataStartRow + attendees.length - 1;
  styleDataRows(worksheet, dataStartRow, dataEndRow, columns.length);

  // Style status and source columns (adjusted for college column addition)
  for (let rowNum = dataStartRow; rowNum <= dataEndRow; rowNum++) {
    const statusCell = worksheet.getRow(rowNum).getCell(11); // Status column (shifted to 11 after adding college)
    styleStatusCell(statusCell, statusCell.value?.toString() || '');
    
    const sourceCell = worksheet.getRow(rowNum).getCell(10); // Source column (shifted to 10 after adding college)
    if (sourceCell.value === 'Waitlist') {
      sourceCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLORS.warningBg },
      };
      sourceCell.font = { ...FONTS.normal, color: { argb: COLORS.warningText } };
    }
  }

  addSummaryRow(worksheet, dataEndRow + 2, 'Total Attendees:', attendees.length, columns.length);

  const filename = `${subEventTitle.replace(/[^a-zA-Z0-9]/g, '_')}_attendees.xlsx`;
  await downloadWorkbook(workbook, filename);
}

/**
 * Export analytics data with multiple styled sheets
 */
export async function exportAnalyticsToExcel(
  analytics: {
    totalEvents: number;
    upcomingEvents: number;
    completedEvents: number;
    cancelledEvents: number;
    totalRegistrations: number;
    totalParticipants: number;
    averageRegistrationsPerEvent: number;
    categoryBreakdown: Array<{ category: string; count: number }>;
    topEvents: Array<{
      title: string;
      registrations: number;
      capacity: number;
      status: string;
      date: string;
    }>;
    recentRegistrations: Array<{
      eventTitle: string;
      userName: string;
      registeredAt: string;
      fromWaitlist: boolean;
    }>;
  },
  filterLabel: string
): Promise<void> {
  const workbook = createStyledWorkbook();
  const timestamp = new Date().toLocaleString();

  // ========== OVERVIEW SHEET ==========
  const overviewSheet = addStyledSheet(workbook, 'Overview', {
    title: '📊 EventHub Analytics Report',
    subtitle: `Filter: ${filterLabel} | Generated: ${timestamp}`,
  });

  // Event Summary Section
  overviewSheet.mergeCells('A1:C1');
  overviewSheet.mergeCells('A2:C2');
  
  const summaryStartRow = 3;
  overviewSheet.getRow(summaryStartRow).values = ['📈 EVENT SUMMARY', '', ''];
  overviewSheet.mergeCells(`A${summaryStartRow}:C${summaryStartRow}`);
  overviewSheet.getRow(summaryStartRow).getCell(1).font = { ...FONTS.header, size: 12 };
  overviewSheet.getRow(summaryStartRow).getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: COLORS.titleBg },
  };

  const headers = ['Metric', 'Value', 'Percentage'];
  overviewSheet.getRow(summaryStartRow + 1).values = headers;
  styleHeaderRow(overviewSheet, summaryStartRow + 1, 3);

  const summaryData = [
    ['Total Events', analytics.totalEvents, '100%'],
    ['Upcoming Events', analytics.upcomingEvents, `${((analytics.upcomingEvents / analytics.totalEvents) * 100 || 0).toFixed(1)}%`],
    ['Completed Events', analytics.completedEvents, `${((analytics.completedEvents / analytics.totalEvents) * 100 || 0).toFixed(1)}%`],
    ['Cancelled Events', analytics.cancelledEvents, `${((analytics.cancelledEvents / analytics.totalEvents) * 100 || 0).toFixed(1)}%`],
  ];

  summaryData.forEach((data, index) => {
    overviewSheet.getRow(summaryStartRow + 2 + index).values = data;
  });
  styleDataRows(overviewSheet, summaryStartRow + 2, summaryStartRow + 1 + summaryData.length, 3);

  // Registration Metrics Section
  const regStartRow = summaryStartRow + summaryData.length + 3;
  overviewSheet.getRow(regStartRow).values = ['📝 REGISTRATION METRICS', '', ''];
  overviewSheet.mergeCells(`A${regStartRow}:C${regStartRow}`);
  overviewSheet.getRow(regStartRow).getCell(1).font = { ...FONTS.header, size: 12 };
  overviewSheet.getRow(regStartRow).getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: COLORS.titleBg },
  };

  const regData = [
    ['Total Registrations', analytics.totalRegistrations, ''],
    ['Confirmed Participants', analytics.totalParticipants, `${((analytics.totalParticipants / analytics.totalRegistrations) * 100 || 0).toFixed(1)}%`],
    ['Avg. Registrations/Event', analytics.averageRegistrationsPerEvent.toFixed(2), ''],
  ];

  overviewSheet.getRow(regStartRow + 1).values = ['Metric', 'Value', 'Notes'];
  styleHeaderRow(overviewSheet, regStartRow + 1, 3);

  regData.forEach((data, index) => {
    overviewSheet.getRow(regStartRow + 2 + index).values = data;
  });
  styleDataRows(overviewSheet, regStartRow + 2, regStartRow + 1 + regData.length, 3);

  overviewSheet.columns = [{ width: 25 }, { width: 20 }, { width: 15 }];

  // ========== CATEGORIES SHEET ==========
  const categorySheet = addStyledSheet(workbook, 'Categories', {
    title: '📂 Category Breakdown',
    subtitle: `Total Categories: ${analytics.categoryBreakdown.length}`,
  });

  categorySheet.mergeCells('A1:C1');
  categorySheet.mergeCells('A2:C2');

  categorySheet.getRow(3).values = ['Category', 'Events Count', '% of Total'];
  styleHeaderRow(categorySheet, 3, 3);

  analytics.categoryBreakdown.forEach((cat, index) => {
    categorySheet.getRow(4 + index).values = [
      cat.category,
      cat.count,
      `${((cat.count / analytics.totalEvents) * 100 || 0).toFixed(1)}%`,
    ];
  });
  styleDataRows(categorySheet, 4, 3 + analytics.categoryBreakdown.length, 3);
  categorySheet.columns = [{ width: 25 }, { width: 15 }, { width: 15 }];

  // ========== TOP EVENTS SHEET ==========
  const topEventsSheet = addStyledSheet(workbook, 'Top Events', {
    title: '🏆 Top Events by Registrations',
    subtitle: `Showing top ${analytics.topEvents.length} events`,
  });

  topEventsSheet.mergeCells('A1:G1');
  topEventsSheet.mergeCells('A2:G2');

  topEventsSheet.getRow(3).values = ['Rank', 'Event Title', 'Registrations', 'Capacity', 'Fill Rate', 'Status', 'Date'];
  styleHeaderRow(topEventsSheet, 3, 7);

  analytics.topEvents.forEach((event, index) => {
    const row = topEventsSheet.getRow(4 + index);
    row.values = [
      `#${index + 1}`,
      event.title,
      event.registrations,
      event.capacity,
      `${((event.registrations / event.capacity) * 100 || 0).toFixed(1)}%`,
      event.status,
      new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    ];
  });
  styleDataRows(topEventsSheet, 4, 3 + analytics.topEvents.length, 7);

  // Style status column
  for (let rowNum = 4; rowNum < 4 + analytics.topEvents.length; rowNum++) {
    const statusCell = topEventsSheet.getRow(rowNum).getCell(6);
    styleStatusCell(statusCell, statusCell.value?.toString() || '');
  }

  topEventsSheet.columns = [{ width: 8 }, { width: 40 }, { width: 15 }, { width: 12 }, { width: 12 }, { width: 15 }, { width: 18 }];

  // ========== RECENT REGISTRATIONS SHEET ==========
  const recentSheet = addStyledSheet(workbook, 'Registrations', {
    title: '📋 Recent Registrations',
    subtitle: `Showing ${analytics.recentRegistrations.length} recent registrations`,
  });

  recentSheet.mergeCells('A1:E1');
  recentSheet.mergeCells('A2:E2');

  recentSheet.getRow(3).values = ['#', 'Event', 'Participant', 'Date', 'Source'];
  styleHeaderRow(recentSheet, 3, 5);

  analytics.recentRegistrations.forEach((reg, index) => {
    recentSheet.getRow(4 + index).values = [
      index + 1,
      reg.eventTitle,
      reg.userName,
      new Date(reg.registeredAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      reg.fromWaitlist ? 'Waitlist' : 'Direct',
    ];
  });
  styleDataRows(recentSheet, 4, 3 + analytics.recentRegistrations.length, 5);

  // Style source column
  for (let rowNum = 4; rowNum < 4 + analytics.recentRegistrations.length; rowNum++) {
    const sourceCell = recentSheet.getRow(rowNum).getCell(5);
    if (sourceCell.value === 'Waitlist') {
      sourceCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLORS.warningBg },
      };
      sourceCell.font = { ...FONTS.normal, color: { argb: COLORS.warningText } };
    }
  }

  recentSheet.columns = [{ width: 6 }, { width: 35 }, { width: 25 }, { width: 22 }, { width: 12 }];

  // Download
  const filename = `EventHub_Analytics_${new Date().toISOString().slice(0, 10)}.xlsx`;
  await downloadWorkbook(workbook, filename);
}

/**
 * Export single event analytics data with styled sheets
 */
export async function exportSingleEventAnalyticsToExcel(
  analytics: {
    totalEvents: number;
    upcomingEvents: number;
    completedEvents: number;
    cancelledEvents: number;
    totalRegistrations: number;
    totalParticipants: number;
    averageRegistrationsPerEvent: number;
    categoryBreakdown: Array<{ category: string; count: number }>;
    topEvents: Array<{
      title: string;
      registrations: number;
      capacity: number;
      status: string;
      date: string;
    }>;
    recentRegistrations: Array<{
      eventTitle: string;
      userName: string;
      registeredAt: string;
      fromWaitlist: boolean;
    }>;
  },
  eventName: string
): Promise<void> {
  const workbook = createStyledWorkbook();
  const timestamp = new Date().toLocaleString();
  const eventInfo = analytics.topEvents[0] || { title: eventName, registrations: 0, capacity: 0, status: 'N/A', date: new Date().toISOString() };

  // ========== EVENT OVERVIEW SHEET ==========
  const overviewSheet = addStyledSheet(workbook, 'Event Overview', {
    title: `📊 ${eventName} - Analytics Report`,
    subtitle: `Generated: ${timestamp}`,
  });

  // Set column widths
  overviewSheet.columns = [{ width: 30 }, { width: 25 }, { width: 20 }];

  // Event Details Section
  overviewSheet.mergeCells('A1:C1');
  overviewSheet.mergeCells('A2:C2');
  
  const detailsStartRow = 3;
  overviewSheet.getRow(detailsStartRow).values = ['📋 EVENT DETAILS', '', ''];
  overviewSheet.mergeCells(`A${detailsStartRow}:C${detailsStartRow}`);
  overviewSheet.getRow(detailsStartRow).getCell(1).font = { ...FONTS.header, size: 12 };
  overviewSheet.getRow(detailsStartRow).getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: COLORS.titleBg },
  };

  overviewSheet.getRow(detailsStartRow + 1).values = ['Metric', 'Value', 'Notes'];
  styleHeaderRow(overviewSheet, detailsStartRow + 1, 3);

  const fillRate = eventInfo.capacity > 0 ? ((eventInfo.registrations / eventInfo.capacity) * 100).toFixed(1) : '0';
  const attendanceRate = analytics.totalRegistrations > 0 
    ? ((analytics.totalParticipants / analytics.totalRegistrations) * 100).toFixed(1) 
    : '0';

  const eventDetailsData = [
    ['Event Name', eventName, ''],
    ['Event Date', new Date(eventInfo.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), ''],
    ['Status', eventInfo.status, ''],
    ['Total Registrations', analytics.totalRegistrations, ''],
    ['Confirmed Participants', analytics.totalParticipants, `${attendanceRate}% attendance rate`],
    ['Capacity', eventInfo.capacity, ''],
    ['Fill Rate', `${fillRate}%`, eventInfo.registrations >= eventInfo.capacity ? 'Fully Booked!' : ''],
    ['Spots Remaining', Math.max(0, eventInfo.capacity - eventInfo.registrations), ''],
  ];

  eventDetailsData.forEach((data, index) => {
    overviewSheet.getRow(detailsStartRow + 2 + index).values = data;
  });
  styleDataRows(overviewSheet, detailsStartRow + 2, detailsStartRow + 1 + eventDetailsData.length, 3);

  // Style status cell
  const statusCell = overviewSheet.getRow(detailsStartRow + 4).getCell(2);
  styleStatusCell(statusCell, statusCell.value?.toString() || '');

  // ========== REGISTRATIONS SHEET ==========
  const recentSheet = addStyledSheet(workbook, 'Registrations', {
    title: `📋 ${eventName} - Registrations`,
    subtitle: `Total Registrations: ${analytics.recentRegistrations.length} | Generated: ${timestamp}`,
  });

  recentSheet.mergeCells('A1:E1');
  recentSheet.mergeCells('A2:E2');

  recentSheet.getRow(3).values = ['S.No', 'Participant Name', 'Registered At', 'Source', 'Status'];
  styleHeaderRow(recentSheet, 3, 5);

  analytics.recentRegistrations.forEach((reg, index) => {
    recentSheet.getRow(4 + index).values = [
      index + 1,
      reg.userName,
      new Date(reg.registeredAt).toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      reg.fromWaitlist ? 'Waitlist' : 'Direct',
      'Registered',
    ];
  });
  
  if (analytics.recentRegistrations.length > 0) {
    styleDataRows(recentSheet, 4, 3 + analytics.recentRegistrations.length, 5);

    // Style source column
    for (let rowNum = 4; rowNum < 4 + analytics.recentRegistrations.length; rowNum++) {
      const sourceCell = recentSheet.getRow(rowNum).getCell(4);
      if (sourceCell.value === 'Waitlist') {
        sourceCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: COLORS.warningBg },
        };
        sourceCell.font = { ...FONTS.normal, color: { argb: COLORS.warningText } };
      }
      
      // Style status as success
      const statusCell = recentSheet.getRow(rowNum).getCell(5);
      styleStatusCell(statusCell, 'registered');
    }
  }

  // Add summary row
  if (analytics.recentRegistrations.length > 0) {
    addSummaryRow(recentSheet, 4 + analytics.recentRegistrations.length + 1, 'Total Registrations:', analytics.recentRegistrations.length, 5);
  }

  recentSheet.columns = [{ width: 8 }, { width: 30 }, { width: 25 }, { width: 15 }, { width: 15 }];

  // Download with event name
  const safeEventName = eventName.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `${safeEventName}_Analysis.xlsx`;
  await downloadWorkbook(workbook, filename);
}
