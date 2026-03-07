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
  } else if (statusLower.includes('cancel') || statusLower.includes('reject') || statusLower.includes('fail') || statusLower.includes('absent')) {
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
  eventTitle: string,
  eventStatus?: string,
  teamMap?: Record<string, { teamName: string; role: string }>,
  teams?: TeamData[],
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
    { header: 'Attendance', key: 'attendance', width: 14 },
    { header: 'Approval Type', key: 'approvalType', width: 18 },
  ];

  // Add team columns if team data is provided
  const hasTeams = teamMap && Object.keys(teamMap).length > 0;
  if (hasTeams) {
    // Insert team columns before Attendance
    columns.splice(11, 0,
      { header: 'Team Name', key: 'teamName', width: 20 },
      { header: 'Team Role', key: 'teamRole', width: 14 },
    );
  }

  // Set column widths manually (don't use worksheet.columns with headers to avoid duplicate header row)
  columns.forEach((col, index) => {
    const column = worksheet.getColumn(index + 1);
    column.width = col.width;
    column.key = col.key;
  });

  // Merge title cells across all columns
  const lastColLetter = String.fromCharCode(64 + columns.length);
  worksheet.mergeCells(`A1:${lastColLetter}1`);
  worksheet.mergeCells(`A2:${lastColLetter}2`);

  // Add header row at row 3
  const headerRowNumber = 3;
  const headerRow = worksheet.getRow(headerRowNumber);
  columns.forEach((col, index) => {
    headerRow.getCell(index + 1).value = col.header;
  });
  styleHeaderRow(worksheet, headerRowNumber, columns.length);

  // Determine if event is completed
  const isCompleted = eventStatus === 'completed';

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

    // Determine attendance label
    const isAttended = participant.status === 'attended';
    const attendanceLabel = isAttended ? 'Attended' : (isCompleted ? 'Absent' : 'Pending');

    const rowValues: (string | number)[] = [
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
    ];

    if (hasTeams) {
      const userId = (participant.user as any)?._id || (participant.user as any)?.id;
      const teamInfo = userId && teamMap ? teamMap[userId] : null;
      rowValues.push(teamInfo?.teamName || 'No Team');
      rowValues.push(teamInfo?.role === 'leader' ? 'Leader' : (teamInfo?.role || 'N/A'));
    }

    rowValues.push(attendanceLabel);
    rowValues.push(approvalTypeLabel);

    row.values = rowValues;
  });

  // Style data rows
  const dataEndRow = dataStartRow + participants.length - 1;
  styleDataRows(worksheet, dataStartRow, dataEndRow, columns.length);

  // Find column indices by key
  const statusColIdx = columns.findIndex(c => c.key === 'status') + 1;
  const attendanceColIdx = columns.findIndex(c => c.key === 'attendance') + 1;

  // Style status and attendance columns
  for (let rowNum = dataStartRow; rowNum <= dataEndRow; rowNum++) {
    const statusCell = worksheet.getRow(rowNum).getCell(statusColIdx);
    styleStatusCell(statusCell, statusCell.value?.toString() || '');
    
    const attendanceCell = worksheet.getRow(rowNum).getCell(attendanceColIdx);
    styleStatusCell(attendanceCell, attendanceCell.value?.toString() || '');
  }

  // Add summary row
  addSummaryRow(worksheet, dataEndRow + 2, 'Total Participants:', participants.length, columns.length);

  // Add Teams Registration sheets if teams data is provided
  if (teams && teams.length > 0) {
    addTeamsSheets(workbook, teams, eventTitle);
  }

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
  subEventTitle: string,
  eventStatus?: string,
  teams?: TeamData[],
): Promise<void> {
  const workbook = createStyledWorkbook();
  
  const worksheet = addStyledSheet(workbook, 'Attendees', {
    title: `📋 ${subEventTitle} - Attendees List`,
    subtitle: `Total Attendees: ${attendees.length} | Generated: ${new Date().toLocaleString()}`,
  });

  const isCompleted = eventStatus === 'completed';

  const columns: ColumnConfig[] = [
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
    { header: 'Attendance', key: 'attendance', width: 14 },
    { header: 'Registered At', key: 'registeredAt', width: 20 },
    { header: 'Scanned At', key: 'scannedAt', width: 20 },
  ];

  // Set column widths manually (don't use worksheet.columns with headers to avoid duplicate header row)
  columns.forEach((col, index) => {
    const column = worksheet.getColumn(index + 1);
    column.width = col.width;
    column.key = col.key;
  });

  // Merge title cells across all columns
  const lastColLetter = String.fromCharCode(64 + columns.length);
  worksheet.mergeCells(`A1:${lastColLetter}1`);
  worksheet.mergeCells(`A2:${lastColLetter}2`);

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
    
    // Determine attendance label
    const isAttended = attendee.status === 'attended';
    const attendanceLabel = isAttended ? 'Attended' : (isCompleted ? 'Absent' : 'Pending');

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
      attendanceLabel,
      new Date(attendee.registeredAt).toLocaleString(),
      attendee.scannedAt ? new Date(attendee.scannedAt).toLocaleString() : 'Not Scanned',
    ];
  });

  const dataEndRow = dataStartRow + attendees.length - 1;
  styleDataRows(worksheet, dataStartRow, dataEndRow, columns.length);

  // Find column indices by key
  const statusColIdx = columns.findIndex(c => c.key === 'status') + 1;
  const attendanceColIdx = columns.findIndex(c => c.key === 'attendance') + 1;
  const sourceColIdx = columns.findIndex(c => c.key === 'source') + 1;

  // Style status, attendance, and source columns
  for (let rowNum = dataStartRow; rowNum <= dataEndRow; rowNum++) {
    const statusCell = worksheet.getRow(rowNum).getCell(statusColIdx);
    styleStatusCell(statusCell, statusCell.value?.toString() || '');
    
    const attendanceCell = worksheet.getRow(rowNum).getCell(attendanceColIdx);
    styleStatusCell(attendanceCell, attendanceCell.value?.toString() || '');
    
    const sourceCell = worksheet.getRow(rowNum).getCell(sourceColIdx);
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

  // Add Teams Registration sheets if teams data is provided
  if (teams && teams.length > 0) {
    addTeamsSheets(workbook, teams, subEventTitle);
  }

  const filename = `${subEventTitle.replace(/[^a-zA-Z0-9]/g, '_')}_attendees.xlsx`;
  await downloadWorkbook(workbook, filename);
}

/**
 * Team data type for teams sheet generation
 */
interface TeamData {
  _id: string;
  name: string;
  status: string;
  leaderId?: { _id?: string; name?: string; email?: string; department?: string; year?: number };
  members?: Array<{
    userId?: { _id?: string; name?: string; email?: string; department?: string; year?: number };
    role?: string;
    joinedAt?: string;
  }>;
  createdAt?: string;
}

/**
 * Add Teams Registration sheets to an existing workbook
 */
function addTeamsSheets(
  workbook: ExcelJS.Workbook,
  teams: TeamData[],
  eventTitle: string
): void {
  if (!teams || teams.length === 0) return;

  // ========== TEAMS OVERVIEW SHEET ==========
  const overviewSheet = addStyledSheet(workbook, 'Teams Overview', {
    title: `📋 ${eventTitle} - Teams Overview`,
    subtitle: `Total Teams: ${teams.length} | Generated: ${new Date().toLocaleString()}`,
  });

  const overviewColumns: ColumnConfig[] = [
    { header: 'S.No', key: 'sno', width: 8 },
    { header: 'Team Name', key: 'teamName', width: 25 },
    { header: 'Leader Name', key: 'leaderName', width: 25 },
    { header: 'Leader Email', key: 'leaderEmail', width: 30 },
    { header: 'Leader Dept', key: 'leaderDept', width: 15 },
    { header: 'Members Count', key: 'membersCount', width: 15 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Created At', key: 'createdAt', width: 20 },
  ];

  overviewColumns.forEach((col, index) => {
    const column = overviewSheet.getColumn(index + 1);
    column.width = col.width;
    column.key = col.key;
  });

  const ovLastCol = String.fromCharCode(64 + overviewColumns.length);
  overviewSheet.mergeCells(`A1:${ovLastCol}1`);
  overviewSheet.mergeCells(`A2:${ovLastCol}2`);

  const ovHeaderRow = 3;
  const ovHeader = overviewSheet.getRow(ovHeaderRow);
  overviewColumns.forEach((col, index) => {
    ovHeader.getCell(index + 1).value = col.header;
  });
  styleHeaderRow(overviewSheet, ovHeaderRow, overviewColumns.length);

  const ovDataStart = 4;
  teams.forEach((team, index) => {
    const row = overviewSheet.getRow(ovDataStart + index);
    const totalMembers = (team.members?.length || 0);
    row.values = [
      index + 1,
      team.name,
      team.leaderId?.name || 'N/A',
      team.leaderId?.email || 'N/A',
      team.leaderId?.department || 'N/A',
      totalMembers,
      team.status.charAt(0).toUpperCase() + team.status.slice(1),
      team.createdAt ? new Date(team.createdAt).toLocaleString() : 'N/A',
    ];
  });

  const ovDataEnd = ovDataStart + teams.length - 1;
  styleDataRows(overviewSheet, ovDataStart, ovDataEnd, overviewColumns.length);

  const ovStatusIdx = overviewColumns.findIndex(c => c.key === 'status') + 1;
  for (let rowNum = ovDataStart; rowNum <= ovDataEnd; rowNum++) {
    const cell = overviewSheet.getRow(rowNum).getCell(ovStatusIdx);
    const val = cell.value?.toString()?.toLowerCase() || '';
    if (val === 'complete' || val === 'registered') {
      styleStatusCell(cell, 'confirmed');
    } else if (val === 'forming') {
      styleStatusCell(cell, 'pending');
    } else if (val === 'disqualified') {
      styleStatusCell(cell, 'rejected');
    }
  }

  addSummaryRow(overviewSheet, ovDataEnd + 2, 'Total Teams:', teams.length, overviewColumns.length);

  // ========== TEAM MEMBERS DETAIL SHEET ==========
  const membersSheet = addStyledSheet(workbook, 'Team Members', {
    title: `📋 ${eventTitle} - All Team Members`,
    subtitle: `Generated: ${new Date().toLocaleString()}`,
  });

  const memberColumns: ColumnConfig[] = [
    { header: 'S.No', key: 'sno', width: 8 },
    { header: 'Team Name', key: 'teamName', width: 25 },
    { header: 'Team Status', key: 'teamStatus', width: 14 },
    { header: 'Member Name', key: 'memberName', width: 25 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Department', key: 'department', width: 15 },
    { header: 'Year', key: 'year', width: 8 },
    { header: 'Role in Team', key: 'teamRole', width: 14 },
    { header: 'Joined At', key: 'joinedAt', width: 20 },
  ];

  memberColumns.forEach((col, index) => {
    const column = membersSheet.getColumn(index + 1);
    column.width = col.width;
    column.key = col.key;
  });

  const memLastCol = String.fromCharCode(64 + memberColumns.length);
  membersSheet.mergeCells(`A1:${memLastCol}1`);
  membersSheet.mergeCells(`A2:${memLastCol}2`);

  const memHeaderRow = 3;
  const memHeader = membersSheet.getRow(memHeaderRow);
  memberColumns.forEach((col, index) => {
    memHeader.getCell(index + 1).value = col.header;
  });
  styleHeaderRow(membersSheet, memHeaderRow, memberColumns.length);

  // Flatten all team members into rows
  const memDataStart = 4;
  let memberRowIndex = 0;
  teams.forEach((team) => {
    // Add leader as first member row
    if (team.leaderId) {
      const row = membersSheet.getRow(memDataStart + memberRowIndex);
      row.values = [
        memberRowIndex + 1,
        team.name,
        team.status.charAt(0).toUpperCase() + team.status.slice(1),
        team.leaderId.name || 'N/A',
        team.leaderId.email || 'N/A',
        team.leaderId.department || 'N/A',
        (team.leaderId as any).year || 'N/A',
        'Leader',
        team.createdAt ? new Date(team.createdAt).toLocaleString() : 'N/A',
      ];
      memberRowIndex++;
    }

    // Add all other members
    (team.members || []).forEach((member) => {
      // Skip if this member is the leader (already added above)
      const memberId = member.userId?._id;
      const leaderId = team.leaderId?._id;
      if (memberId && leaderId && memberId === leaderId) return;

      const row = membersSheet.getRow(memDataStart + memberRowIndex);
      row.values = [
        memberRowIndex + 1,
        team.name,
        team.status.charAt(0).toUpperCase() + team.status.slice(1),
        member.userId?.name || 'N/A',
        member.userId?.email || 'N/A',
        member.userId?.department || 'N/A',
        (member.userId as any)?.year || 'N/A',
        member.role === 'leader' ? 'Leader' : 'Member',
        member.joinedAt ? new Date(member.joinedAt).toLocaleString() : 'N/A',
      ];
      memberRowIndex++;
    });
  });

  const memDataEnd = memDataStart + memberRowIndex - 1;
  if (memberRowIndex > 0) {
    styleDataRows(membersSheet, memDataStart, memDataEnd, memberColumns.length);

    // Style team role column
    const roleIdx = memberColumns.findIndex(c => c.key === 'teamRole') + 1;
    for (let rowNum = memDataStart; rowNum <= memDataEnd; rowNum++) {
      const roleCell = membersSheet.getRow(rowNum).getCell(roleIdx);
      if (roleCell.value === 'Leader') {
        roleCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF2CC' },
        };
        roleCell.font = { ...FONTS.bold, color: { argb: '7F6003' } };
      }
    }

    // Style team status column
    const teamStatusIdx = memberColumns.findIndex(c => c.key === 'teamStatus') + 1;
    for (let rowNum = memDataStart; rowNum <= memDataEnd; rowNum++) {
      const cell = membersSheet.getRow(rowNum).getCell(teamStatusIdx);
      const val = cell.value?.toString()?.toLowerCase() || '';
      if (val === 'complete' || val === 'registered') {
        styleStatusCell(cell, 'confirmed');
      } else if (val === 'forming') {
        styleStatusCell(cell, 'pending');
      } else if (val === 'disqualified') {
        styleStatusCell(cell, 'rejected');
      }
    }

    addSummaryRow(membersSheet, memDataEnd + 2, 'Total Members:', memberRowIndex, memberColumns.length);
  }
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
    totalAttended?: number;
    averageRegistrationsPerEvent: number;
    categoryBreakdown: Array<{ category: string; count: number }>;
    topEvents: Array<{
      title: string;
      registrations: number;
      capacity: number;
      status: string;
      date: string;
      createdBy?: string;
      department?: string;
    }>;
    recentRegistrations: Array<{
      eventTitle: string;
      userName: string;
      registeredAt: string;
      fromWaitlist: boolean;
      status?: string;
      approvalStatus?: string;
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

  const allTotalAttended = analytics.totalAttended ?? analytics.recentRegistrations.filter(r => r.status === 'attended').length;
  const approvalRate = analytics.totalRegistrations > 0 ? ((analytics.totalParticipants / analytics.totalRegistrations) * 100).toFixed(1) : '0.0';
  const attendanceRate = analytics.totalParticipants > 0 ? ((allTotalAttended / analytics.totalParticipants) * 100).toFixed(1) : '0.0';
  const completionRate = analytics.totalEvents > 0 ? ((analytics.completedEvents / analytics.totalEvents) * 100).toFixed(1) : '0.0';

  const regData = [
    ['Total Registrations', analytics.totalRegistrations, ''],
    ['Approved Participants', analytics.totalParticipants, `${approvalRate}% of registrations`],
    ['Total Attended', allTotalAttended, `${attendanceRate}% of approved`],
    ['Not Attended', analytics.totalParticipants - allTotalAttended, ''],
    ['Avg. Registrations/Event', analytics.averageRegistrationsPerEvent.toFixed(2), ''],
  ];

  overviewSheet.getRow(regStartRow + 1).values = ['Metric', 'Value', 'Notes'];
  styleHeaderRow(overviewSheet, regStartRow + 1, 3);

  regData.forEach((data, index) => {
    overviewSheet.getRow(regStartRow + 2 + index).values = data;
  });
  styleDataRows(overviewSheet, regStartRow + 2, regStartRow + 1 + regData.length, 3);

  // Key Rates Section
  const ratesStartRow = regStartRow + regData.length + 3;
  overviewSheet.getRow(ratesStartRow).values = ['📊 KEY RATES', '', ''];
  overviewSheet.mergeCells(`A${ratesStartRow}:C${ratesStartRow}`);
  overviewSheet.getRow(ratesStartRow).getCell(1).font = { ...FONTS.header, size: 12 };
  overviewSheet.getRow(ratesStartRow).getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.titleBg } };

  overviewSheet.getRow(ratesStartRow + 1).values = ['Rate', 'Value', 'Description'];
  styleHeaderRow(overviewSheet, ratesStartRow + 1, 3);

  const ratesData: (string | number)[][] = [
    ['Completion Rate', `${completionRate}%`, `${analytics.completedEvents} of ${analytics.totalEvents} events completed`],
    ['Approval Rate', `${approvalRate}%`, `${analytics.totalParticipants} of ${analytics.totalRegistrations} registrations approved`],
    ['Attendance Rate', `${attendanceRate}%`, `${allTotalAttended} of ${analytics.totalParticipants} approved participants attended`],
  ];

  ratesData.forEach((data, index) => {
    const r = ratesStartRow + 2 + index;
    overviewSheet.getRow(r).values = data;
    overviewSheet.getRow(r).getCell(1).font = FONTS.bold;
    // Color the value cell based on percentage
    const pctVal = parseFloat(data[1] as string);
    const cell = overviewSheet.getRow(r).getCell(2);
    cell.font = { ...FONTS.bold, size: 11 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    if (pctVal >= 75) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.successBg } };
      cell.font = { ...FONTS.bold, size: 11, color: { argb: COLORS.successText } };
    } else if (pctVal >= 40) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.warningBg } };
      cell.font = { ...FONTS.bold, size: 11, color: { argb: COLORS.warningText } };
    } else {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.errorBg } };
      cell.font = { ...FONTS.bold, size: 11, color: { argb: COLORS.errorText } };
    }
  });
  styleDataRows(overviewSheet, ratesStartRow + 2, ratesStartRow + 1 + ratesData.length, 3);

  overviewSheet.columns = [{ width: 28 }, { width: 20 }, { width: 45 }];

  // ========== VISUAL DASHBOARD SHEET ==========
  const dashSheet = addStyledSheet(workbook, 'Dashboard', {
    title: '📊 Visual Dashboard',
    subtitle: `Generated: ${timestamp}`,
  });

  dashSheet.mergeCells('A1:F1');
  dashSheet.mergeCells('A2:F2');

  // Helper to create a text-based bar
  const makeBar = (value: number, max: number, width: number = 20): string => {
    if (max === 0) return '░'.repeat(width);
    const filled = Math.round((value / max) * width);
    return '█'.repeat(Math.min(filled, width)) + '░'.repeat(Math.max(0, width - filled));
  };

  // --- Event Status Distribution ---
  let row = 3;
  dashSheet.getRow(row).values = ['📈 EVENT STATUS DISTRIBUTION', '', '', '', '', ''];
  dashSheet.mergeCells(`A${row}:F${row}`);
  dashSheet.getRow(row).getCell(1).font = { ...FONTS.header, size: 12 };
  dashSheet.getRow(row).getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.titleBg } };
  row++;
  dashSheet.getRow(row).values = ['Status', 'Count', '% of Total', 'Visual', '', ''];
  styleHeaderRow(dashSheet, row, 6);
  row++;

  const maxEvents = analytics.totalEvents;
  const eventStatusData = [
    { label: 'Upcoming', value: analytics.upcomingEvents, color: COLORS.headerBg },
    { label: 'Completed', value: analytics.completedEvents, color: COLORS.successText },
    { label: 'Cancelled', value: analytics.cancelledEvents, color: COLORS.errorText },
  ];

  eventStatusData.forEach((item) => {
    const pct = maxEvents > 0 ? ((item.value / maxEvents) * 100).toFixed(1) : '0.0';
    dashSheet.getRow(row).values = [item.label, item.value, `${pct}%`, makeBar(item.value, maxEvents), '', ''];
    dashSheet.getRow(row).getCell(4).font = { name: 'Consolas', size: 10, color: { argb: item.color } };
    dashSheet.getRow(row).getCell(1).font = FONTS.bold;
    dashSheet.getRow(row).getCell(2).font = FONTS.bold;
    row++;
  });

  styleDataRows(dashSheet, row - eventStatusData.length, row - 1, 6);

  // --- Registration & Attendance Overview ---
  row += 2;
  dashSheet.getRow(row).values = ['📝 REGISTRATION & ATTENDANCE', '', '', '', '', ''];
  dashSheet.mergeCells(`A${row}:F${row}`);
  dashSheet.getRow(row).getCell(1).font = { ...FONTS.header, size: 12 };
  dashSheet.getRow(row).getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.titleBg } };
  row++;
  dashSheet.getRow(row).values = ['Metric', 'Count', '% of Registrations', 'Visual', '', ''];
  styleHeaderRow(dashSheet, row, 6);
  row++;

  const dashTotalAttended = analytics.totalAttended ?? analytics.recentRegistrations.filter(r => r.status === 'attended').length;
  const maxRegs = analytics.totalRegistrations;
  const regBarData = [
    { label: 'Total Registrations', value: analytics.totalRegistrations, color: COLORS.headerBg },
    { label: 'Approved', value: analytics.totalParticipants, color: '2E7D32' },
    { label: 'Attended', value: dashTotalAttended, color: COLORS.successText },
    { label: 'Not Attended', value: analytics.totalParticipants - dashTotalAttended, color: COLORS.warningText },
  ];

  regBarData.forEach((item) => {
    const pct = maxRegs > 0 ? ((item.value / maxRegs) * 100).toFixed(1) : '0.0';
    dashSheet.getRow(row).values = [item.label, item.value, `${pct}%`, makeBar(item.value, maxRegs), '', ''];
    dashSheet.getRow(row).getCell(4).font = { name: 'Consolas', size: 10, color: { argb: item.color } };
    dashSheet.getRow(row).getCell(1).font = FONTS.bold;
    dashSheet.getRow(row).getCell(2).font = FONTS.bold;
    row++;
  });

  styleDataRows(dashSheet, row - regBarData.length, row - 1, 6);

  // --- Category Breakdown Visual ---
  if (analytics.categoryBreakdown.length > 0) {
    row += 2;
    dashSheet.getRow(row).values = ['📂 CATEGORY BREAKDOWN', '', '', '', '', ''];
    dashSheet.mergeCells(`A${row}:F${row}`);
    dashSheet.getRow(row).getCell(1).font = { ...FONTS.header, size: 12 };
    dashSheet.getRow(row).getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.titleBg } };
    row++;
    dashSheet.getRow(row).values = ['Category', 'Events', '% of Total', 'Visual', '', ''];
    styleHeaderRow(dashSheet, row, 6);
    row++;

    const maxCat = Math.max(...analytics.categoryBreakdown.map(c => c.count), 1);
    const catColors = ['4472C4', 'ED7D31', 'A5A5A5', 'FFC000', '5B9BD5', '70AD47', 'C00000', '7030A0'];
    analytics.categoryBreakdown.forEach((cat, i) => {
      const pct = analytics.totalEvents > 0 ? ((cat.count / analytics.totalEvents) * 100).toFixed(1) : '0.0';
      const color = catColors[i % catColors.length];
      dashSheet.getRow(row).values = [cat.category, cat.count, `${pct}%`, makeBar(cat.count, maxCat), '', ''];
      dashSheet.getRow(row).getCell(4).font = { name: 'Consolas', size: 10, color: { argb: color } };
      dashSheet.getRow(row).getCell(1).font = FONTS.bold;
      row++;
    });
    styleDataRows(dashSheet, row - analytics.categoryBreakdown.length, row - 1, 6);
  }

  // --- Top Events Fill Rate ---
  if (analytics.topEvents.length > 0) {
    row += 2;
    dashSheet.getRow(row).values = ['🏆 TOP EVENTS - FILL RATE', '', '', '', '', ''];
    dashSheet.mergeCells(`A${row}:F${row}`);
    dashSheet.getRow(row).getCell(1).font = { ...FONTS.header, size: 12 };
    dashSheet.getRow(row).getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.titleBg } };
    row++;
    dashSheet.getRow(row).values = ['Event', 'Regs / Cap', 'Fill Rate', 'Visual', '', ''];
    styleHeaderRow(dashSheet, row, 6);
    row++;

    analytics.topEvents.slice(0, 10).forEach((evt) => {
      const fillPct = evt.capacity > 0 ? ((evt.registrations / evt.capacity) * 100) : 0;
      const fillColor = fillPct >= 90 ? COLORS.successText : fillPct >= 50 ? COLORS.warningText : COLORS.errorText;
      dashSheet.getRow(row).values = [
        evt.title.length > 35 ? evt.title.substring(0, 35) + '...' : evt.title,
        `${evt.registrations} / ${evt.capacity}`,
        `${fillPct.toFixed(1)}%`,
        makeBar(evt.registrations, evt.capacity),
        '', ''
      ];
      dashSheet.getRow(row).getCell(4).font = { name: 'Consolas', size: 10, color: { argb: fillColor } };
      dashSheet.getRow(row).getCell(1).font = FONTS.bold;
      row++;
    });
    styleDataRows(dashSheet, row - analytics.topEvents.slice(0, 10).length, row - 1, 6);
  }

  // --- Key Rates Visual ---
  row += 2;
  dashSheet.getRow(row).values = ['🎯 KEY PERFORMANCE RATES', '', '', '', '', ''];
  dashSheet.mergeCells(`A${row}:F${row}`);
  dashSheet.getRow(row).getCell(1).font = { ...FONTS.header, size: 12 };
  dashSheet.getRow(row).getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.titleBg } };
  row++;
  dashSheet.getRow(row).values = ['Rate', 'Percentage', 'Formula', 'Visual', '', ''];
  styleHeaderRow(dashSheet, row, 6);
  row++;

  const dashCompletionRate = analytics.totalEvents > 0 ? (analytics.completedEvents / analytics.totalEvents) * 100 : 0;
  const dashApprovalRate = analytics.totalRegistrations > 0 ? (analytics.totalParticipants / analytics.totalRegistrations) * 100 : 0;
  const dashAttendanceRate = analytics.totalParticipants > 0 ? (dashTotalAttended / analytics.totalParticipants) * 100 : 0;

  const ratesBarData = [
    { label: 'Event Completion Rate', pct: dashCompletionRate, formula: `${analytics.completedEvents} completed / ${analytics.totalEvents} total events`, color: dashCompletionRate >= 75 ? COLORS.successText : dashCompletionRate >= 40 ? COLORS.warningText : COLORS.errorText },
    { label: 'Registration Approval Rate', pct: dashApprovalRate, formula: `${analytics.totalParticipants} approved / ${analytics.totalRegistrations} total registrations`, color: dashApprovalRate >= 75 ? COLORS.successText : dashApprovalRate >= 40 ? COLORS.warningText : COLORS.errorText },
    { label: 'Attendance Rate', pct: dashAttendanceRate, formula: `${dashTotalAttended} attended / ${analytics.totalParticipants} approved participants`, color: dashAttendanceRate >= 75 ? COLORS.successText : dashAttendanceRate >= 40 ? COLORS.warningText : COLORS.errorText },
  ];

  ratesBarData.forEach((item) => {
    dashSheet.getRow(row).values = [item.label, `${item.pct.toFixed(1)}%`, item.formula, makeBar(Math.round(item.pct), 100), '', ''];
    dashSheet.getRow(row).getCell(4).font = { name: 'Consolas', size: 10, color: { argb: item.color } };
    dashSheet.getRow(row).getCell(1).font = FONTS.bold;
    const pctCell = dashSheet.getRow(row).getCell(2);
    pctCell.font = { ...FONTS.bold, size: 11, color: { argb: item.color } };
    pctCell.alignment = { vertical: 'middle', horizontal: 'center' };
    row++;
  });
  styleDataRows(dashSheet, row - ratesBarData.length, row - 1, 6);

  dashSheet.columns = [{ width: 30 }, { width: 15 }, { width: 42 }, { width: 30 }, { width: 5 }, { width: 5 }];

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

  topEventsSheet.mergeCells('A1:I1');
  topEventsSheet.mergeCells('A2:I2');

  topEventsSheet.getRow(3).values = ['Rank', 'Event Title', 'Conducted By', 'Department', 'Registrations', 'Capacity', 'Fill Rate', 'Status', 'Date'];
  styleHeaderRow(topEventsSheet, 3, 9);

  analytics.topEvents.forEach((event, index) => {
    const row = topEventsSheet.getRow(4 + index);
    row.values = [
      `#${index + 1}`,
      event.title,
      event.createdBy || 'N/A',
      event.department || 'N/A',
      event.registrations,
      event.capacity,
      `${((event.registrations / event.capacity) * 100 || 0).toFixed(1)}%`,
      event.status,
      new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    ];
  });
  styleDataRows(topEventsSheet, 4, 3 + analytics.topEvents.length, 9);

  // Style status column (now column 8)
  for (let rowNum = 4; rowNum < 4 + analytics.topEvents.length; rowNum++) {
    const statusCell = topEventsSheet.getRow(rowNum).getCell(8);
    styleStatusCell(statusCell, statusCell.value?.toString() || '');
  }

  topEventsSheet.columns = [{ width: 8 }, { width: 35 }, { width: 20 }, { width: 18 }, { width: 15 }, { width: 12 }, { width: 12 }, { width: 15 }, { width: 18 }];

  // ========== RECENT REGISTRATIONS SHEET ==========
  const recentSheet = addStyledSheet(workbook, 'Registrations', {
    title: '📋 Recent Registrations',
    subtitle: `Showing ${analytics.recentRegistrations.length} recent registrations`,
  });

  recentSheet.mergeCells('A1:E1');
  recentSheet.mergeCells('A2:E2');

  recentSheet.getRow(3).values = ['#', 'Event', 'Participant', 'Date', 'Attended'];
  styleHeaderRow(recentSheet, 3, 5);

  analytics.recentRegistrations.forEach((reg, index) => {
    const isAttended = reg.status === 'attended';
    recentSheet.getRow(4 + index).values = [
      index + 1,
      reg.eventTitle,
      reg.userName,
      new Date(reg.registeredAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      isAttended ? 'Yes' : 'No',
    ];
  });
  styleDataRows(recentSheet, 4, 3 + analytics.recentRegistrations.length, 5);

  // Style attended column
  for (let rowNum = 4; rowNum < 4 + analytics.recentRegistrations.length; rowNum++) {
    const attendedCell = recentSheet.getRow(rowNum).getCell(5);
    if (attendedCell.value === 'Yes') {
      attendedCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLORS.successBg },
      };
      attendedCell.font = { ...FONTS.normal, color: { argb: COLORS.successText } };
    } else {
      attendedCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLORS.warningBg },
      };
      attendedCell.font = { ...FONTS.normal, color: { argb: COLORS.warningText } };
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
    totalAttended?: number;
    averageRegistrationsPerEvent: number;
    categoryBreakdown: Array<{ category: string; count: number }>;
    topEvents: Array<{
      title: string;
      registrations: number;
      capacity: number;
      status: string;
      date: string;
      createdBy?: string;
      department?: string;
    }>;
    recentRegistrations: Array<{
      eventTitle: string;
      userName: string;
      registeredAt: string;
      fromWaitlist: boolean;
      status?: string;
      approvalStatus?: string;
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
  const totalAttendedCount = analytics.totalAttended ?? analytics.recentRegistrations.filter(r => r.status === 'attended').length;
  // Attendance rate = attended / approved participants (not total registrations)
  const attendanceRate = analytics.totalParticipants > 0 
    ? ((totalAttendedCount / analytics.totalParticipants) * 100).toFixed(1) 
    : '0';
  const singleApprovalRate = analytics.totalRegistrations > 0
    ? ((analytics.totalParticipants / analytics.totalRegistrations) * 100).toFixed(1)
    : '0';

  const eventDetailsData = [
    ['Event Name', eventName, ''],
    ['Conducted By', eventInfo.createdBy || 'N/A', `Department: ${eventInfo.department || 'N/A'}`],
    ['Event Date', new Date(eventInfo.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), ''],
    ['Status', eventInfo.status, ''],
    ['Capacity', eventInfo.capacity, ''],
    ['Total Registrations', analytics.totalRegistrations, ''],
    ['Approved Participants', analytics.totalParticipants, `${singleApprovalRate}% of registrations approved`],
    ['Total Attended', totalAttendedCount, `${attendanceRate}% of approved attended`],
    ['Not Attended', analytics.totalParticipants - totalAttendedCount, ''],
    ['Fill Rate', `${fillRate}%`, eventInfo.registrations >= eventInfo.capacity ? '⭐ Fully Booked!' : `${Math.max(0, eventInfo.capacity - eventInfo.registrations)} spots remaining`],
  ];

  eventDetailsData.forEach((data, index) => {
    overviewSheet.getRow(detailsStartRow + 2 + index).values = data;
  });
  styleDataRows(overviewSheet, detailsStartRow + 2, detailsStartRow + 1 + eventDetailsData.length, 3);

  // Style "Conducted By" row
  overviewSheet.getRow(detailsStartRow + 3).getCell(1).font = FONTS.bold;
  overviewSheet.getRow(detailsStartRow + 3).getCell(3).font = { ...FONTS.normal, italic: true };

  // Style status cell (row offset: Event Name=0, Conducted By=1, Date=2, Status=3 → row detailsStartRow+5)
  const statusCell = overviewSheet.getRow(detailsStartRow + 5).getCell(2);
  styleStatusCell(statusCell, statusCell.value?.toString() || '');

  // --- Helper for bar charts ---
  const makeBar = (value: number, max: number, width: number = 20): string => {
    if (max === 0) return '░'.repeat(width);
    const filled = Math.round((value / max) * width);
    return '█'.repeat(Math.min(filled, width)) + '░'.repeat(Math.max(0, width - filled));
  };

  // --- Key Performance Rates ---
  const ratesRow = detailsStartRow + 2 + eventDetailsData.length + 2;
  overviewSheet.getRow(ratesRow).values = ['🎯 KEY PERFORMANCE RATES', '', ''];
  overviewSheet.mergeCells(`A${ratesRow}:C${ratesRow}`);
  overviewSheet.getRow(ratesRow).getCell(1).font = { ...FONTS.header, size: 12 };
  overviewSheet.getRow(ratesRow).getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.titleBg } };

  overviewSheet.getRow(ratesRow + 1).values = ['Rate', 'Value', 'How It\'s Calculated'];
  styleHeaderRow(overviewSheet, ratesRow + 1, 3);

  const singleFillPct = parseFloat(fillRate);
  const singleAttPct = parseFloat(attendanceRate);
  const singleAppPct = parseFloat(singleApprovalRate);

  const singleRatesData: { label: string; pct: number; desc: string }[] = [
    { label: 'Fill Rate', pct: singleFillPct, desc: `${analytics.totalRegistrations} registrations / ${eventInfo.capacity} capacity` },
    { label: 'Approval Rate', pct: singleAppPct, desc: `${analytics.totalParticipants} approved / ${analytics.totalRegistrations} total registrations` },
    { label: 'Attendance Rate', pct: singleAttPct, desc: `${totalAttendedCount} attended / ${analytics.totalParticipants} approved participants` },
  ];

  singleRatesData.forEach((item, i) => {
    const r = ratesRow + 2 + i;
    overviewSheet.getRow(r).values = [item.label, `${item.pct.toFixed(1)}%`, item.desc];
    overviewSheet.getRow(r).getCell(1).font = FONTS.bold;
    const pctCell = overviewSheet.getRow(r).getCell(2);
    pctCell.alignment = { vertical: 'middle', horizontal: 'center' };
    if (item.pct >= 75) {
      pctCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.successBg } };
      pctCell.font = { ...FONTS.bold, size: 11, color: { argb: COLORS.successText } };
    } else if (item.pct >= 40) {
      pctCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.warningBg } };
      pctCell.font = { ...FONTS.bold, size: 11, color: { argb: COLORS.warningText } };
    } else {
      pctCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.errorBg } };
      pctCell.font = { ...FONTS.bold, size: 11, color: { argb: COLORS.errorText } };
    }
  });
  styleDataRows(overviewSheet, ratesRow + 2, ratesRow + 1 + singleRatesData.length, 3);

  // --- Visual Bar Charts ---
  const vizStartRow = ratesRow + singleRatesData.length + 3;
  overviewSheet.getRow(vizStartRow).values = ['📊 VISUAL COMPARISON', '', ''];
  overviewSheet.mergeCells(`A${vizStartRow}:C${vizStartRow}`);
  overviewSheet.getRow(vizStartRow).getCell(1).font = { ...FONTS.header, size: 12 };
  overviewSheet.getRow(vizStartRow).getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.titleBg } };

  overviewSheet.getRow(vizStartRow + 1).values = ['Metric', 'Count', 'Visual Bar'];
  styleHeaderRow(overviewSheet, vizStartRow + 1, 3);

  const maxVal = Math.max(analytics.totalRegistrations, eventInfo.capacity, 1);
  const vizData = [
    { label: 'Capacity', value: eventInfo.capacity, color: 'A5A5A5' },
    { label: 'Registrations', value: analytics.totalRegistrations, color: COLORS.headerBg },
    { label: 'Approved', value: analytics.totalParticipants, color: '2E7D32' },
    { label: 'Attended', value: totalAttendedCount, color: COLORS.successText },
    { label: 'Not Attended', value: analytics.totalParticipants - totalAttendedCount, color: COLORS.warningText },
  ];

  vizData.forEach((item, i) => {
    const r = vizStartRow + 2 + i;
    overviewSheet.getRow(r).values = [item.label, item.value, makeBar(item.value, maxVal)];
    overviewSheet.getRow(r).getCell(3).font = { name: 'Consolas', size: 10, color: { argb: item.color } };
    overviewSheet.getRow(r).getCell(1).font = FONTS.bold;
    overviewSheet.getRow(r).getCell(2).font = FONTS.bold;
  });
  styleDataRows(overviewSheet, vizStartRow + 2, vizStartRow + 1 + vizData.length, 3);

  // --- Rate Gauges (percentage bars out of 100%) ---
  const gaugeStartRow = vizStartRow + vizData.length + 3;
  overviewSheet.getRow(gaugeStartRow).values = ['📈 RATE GAUGES', '', ''];
  overviewSheet.mergeCells(`A${gaugeStartRow}:C${gaugeStartRow}`);
  overviewSheet.getRow(gaugeStartRow).getCell(1).font = { ...FONTS.header, size: 12 };
  overviewSheet.getRow(gaugeStartRow).getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.titleBg } };

  overviewSheet.getRow(gaugeStartRow + 1).values = ['Rate', 'Percentage', 'Gauge (0-100%)'];
  styleHeaderRow(overviewSheet, gaugeStartRow + 1, 3);

  const gaugeData = [
    { label: 'Fill Rate', pct: singleFillPct, color: singleFillPct >= 90 ? COLORS.successText : singleFillPct >= 50 ? COLORS.warningText : COLORS.errorText },
    { label: 'Approval Rate', pct: singleAppPct, color: singleAppPct >= 75 ? COLORS.successText : singleAppPct >= 40 ? COLORS.warningText : COLORS.errorText },
    { label: 'Attendance Rate', pct: singleAttPct, color: singleAttPct >= 75 ? COLORS.successText : singleAttPct >= 40 ? COLORS.warningText : COLORS.errorText },
  ];

  gaugeData.forEach((item, i) => {
    const r = gaugeStartRow + 2 + i;
    overviewSheet.getRow(r).values = [item.label, `${item.pct.toFixed(1)}%`, makeBar(Math.round(item.pct), 100)];
    overviewSheet.getRow(r).getCell(3).font = { name: 'Consolas', size: 10, color: { argb: item.color } };
    overviewSheet.getRow(r).getCell(1).font = FONTS.bold;
    overviewSheet.getRow(r).getCell(2).font = { ...FONTS.bold, size: 11 };
    overviewSheet.getRow(r).getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
  });
  styleDataRows(overviewSheet, gaugeStartRow + 2, gaugeStartRow + 1 + gaugeData.length, 3);

  // Update column widths to fit visual bars
  overviewSheet.columns = [{ width: 30 }, { width: 25 }, { width: 45 }];

  // ========== REGISTRATIONS SHEET ==========
  const recentSheet = addStyledSheet(workbook, 'Registrations', {
    title: `📋 ${eventName} - Registrations`,
    subtitle: `Total Registrations: ${analytics.recentRegistrations.length} | Generated: ${timestamp}`,
  });

  recentSheet.mergeCells('A1:D1');
  recentSheet.mergeCells('A2:D2');

  recentSheet.getRow(3).values = ['S.No', 'Participant Name', 'Registered At', 'Attended'];
  styleHeaderRow(recentSheet, 3, 4);

  analytics.recentRegistrations.forEach((reg, index) => {
    const isAttended = reg.status === 'attended';
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
      isAttended ? 'Yes' : 'No',
    ];
  });
  
  if (analytics.recentRegistrations.length > 0) {
    styleDataRows(recentSheet, 4, 3 + analytics.recentRegistrations.length, 4);

    // Style attended column
    for (let rowNum = 4; rowNum < 4 + analytics.recentRegistrations.length; rowNum++) {
      const attendedCell = recentSheet.getRow(rowNum).getCell(4);
      if (attendedCell.value === 'Yes') {
        attendedCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: COLORS.successBg },
        };
        attendedCell.font = { ...FONTS.normal, color: { argb: COLORS.successText } };
      } else {
        attendedCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: COLORS.warningBg },
        };
        attendedCell.font = { ...FONTS.normal, color: { argb: COLORS.warningText } };
      }
    }
  }

  // Add summary rows
  if (analytics.recentRegistrations.length > 0) {
    const attendedCount = analytics.recentRegistrations.filter(r => r.status === 'attended').length;
    addSummaryRow(recentSheet, 4 + analytics.recentRegistrations.length + 1, 'Total Registrations:', analytics.recentRegistrations.length, 4);
    addSummaryRow(recentSheet, 4 + analytics.recentRegistrations.length + 2, 'Total Attended:', attendedCount, 4);
  }

  recentSheet.columns = [{ width: 8 }, { width: 30 }, { width: 25 }, { width: 15 }];

  // Download with event name
  const safeEventName = eventName.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `${safeEventName}_Analysis.xlsx`;
  await downloadWorkbook(workbook, filename);
}
