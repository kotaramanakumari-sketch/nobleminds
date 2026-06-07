/**
 * pdf.js - Targeted PDF export for specific tables
 */

async function nmDownloadTablePDF(btn, docTitle = 'Table Records', fileSuffix = 'data') {
  const sandbox = document.createElement('div');
  const container = document.createElement('div');
  
  try {
    // Show loading state
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Generating...';
    btn.disabled = true;

    // Find the localized container (tab or page section) and its specific table
    const containerWrapper = btn.closest('.mgmt-tab-content, .page-section');
    const table = containerWrapper.querySelector('.data-table');
    if (!table) throw new Error("Table not found.");

    // Clone table and remove Actions column
    const clonedTable = table.cloneNode(true);
    const headers = Array.from(clonedTable.querySelectorAll('thead th'));
    const actionsIdx = headers.findIndex(th => th.textContent.trim().toLowerCase() === 'actions');
    
    if (actionsIdx !== -1) {
      headers[actionsIdx].remove();
      clonedTable.querySelectorAll('tbody tr').forEach(tr => {
        const cells = tr.querySelectorAll('td');
        if (cells[actionsIdx]) cells[actionsIdx].remove();
      });
    }

    // Apply inline print styles to table
    clonedTable.style.width = '100%';
    clonedTable.style.borderCollapse = 'collapse';
    clonedTable.style.fontSize = '0.8rem';
    clonedTable.querySelectorAll('th, td').forEach(cell => {
      cell.style.borderBottom = '1px solid #ddd';
      cell.style.padding = '8px 12px';
      cell.style.textAlign = 'left';
      cell.style.whiteSpace = 'normal';
      cell.style.wordBreak = 'break-word';
      cell.style.overflowWrap = 'break-word';
      cell.querySelectorAll('*').forEach(el => {
        el.style.whiteSpace = 'normal';
        el.style.overflow = 'visible';
        el.style.textOverflow = 'clip';
        el.style.maxHeight = 'none';
      });
    });

    // Setup Sandbox (Absolute position off-screen, NOT fixed, to allow full document height)
    sandbox.style.position = 'absolute';
    sandbox.style.left = '-9999px';
    sandbox.style.top = '0';
    sandbox.style.pointerEvents = 'none';
    sandbox.style.width = 'max-content';

    // Setup Container
    container.style.width = 'max-content';
    container.style.minWidth = '1100px';
    container.style.padding = '40px';
    container.style.boxSizing = 'border-box';
    container.style.background = '#fff';
    container.style.color = '#333';
    container.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    container.classList.add('pdf-export-mode');

    const schoolName = document.getElementById('sb-school-name')?.textContent || 'NobleMinds Platform';

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #6c63ff; padding-bottom:15px; margin-bottom:20px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div>
            <h1 style="margin:0; font-size:1.4rem; color:#1e1e2d;">${docTitle}</h1>
            <p style="margin:2px 0 0 0; font-size:0.8rem; color:#666;">${schoolName}</p>
          </div>
        </div>
        <div style="text-align:right; font-size:0.75rem; color:#666;">
          <div>Date: ${new Date().toLocaleDateString('en-IN')}</div>
        </div>
      </div>
      <div id="pdf-table-wrapper"></div>
      <div style="margin-top: 30px; text-align: center; border-top: 1px solid #ddd; padding-top: 15px; font-size: 0.8rem; color: #666; display: flex; align-items: center; justify-content: center; gap: 8px;">
        <img src="../assets/logo.png" style="width:24px; height:24px; object-fit:contain;">
        <span>Powered by NobleMinds</span>
      </div>
    `;
    
    container.querySelector('#pdf-table-wrapper').appendChild(clonedTable);
    sandbox.appendChild(container);
    document.body.appendChild(sandbox);

    // Give browser a moment to paint the DOM
    await new Promise(r => setTimeout(r, 200));

    const safeSchoolName = schoolName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `${safeSchoolName}_${fileSuffix}.pdf`;

    const opt = {
      margin:       10,
      filename:     filename,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { 
        scale: 2, 
        useCORS: true
      },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    // Use output('blob') directly to bypass html2pdf's broken save logic
    const pdfBlob = await html2pdf().set(opt).from(container).output('blob');
    
    // Fallback: manually trigger the download using a hidden anchor tag
    const blobUrl = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    }, 500);

    nmToast('PDF generated successfully!', 'success');
    btn.innerHTML = originalText;
    btn.disabled = false;

  } catch (err) {
    console.error('[PDF Export] Error:', err);
    nmToast('Failed to generate PDF.', 'error');
    btn.innerHTML = '📄 Download PDF';
    btn.disabled = false;
  } finally {
    if (sandbox && sandbox.parentNode) {
      document.body.removeChild(sandbox);
    }
  }
}

async function nmDownloadProfilePDF(id, btn) {
  const sandbox = document.createElement('div');
  const container = document.createElement('div');
  
  try {
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Generating...';
    btn.disabled = true;

    // Extract the profile directly from the visible modal
    const modalBody = document.getElementById('student-modal-body') || document.getElementById('student-view-body');
    if (!modalBody) throw new Error("Profile not loaded.");

    // Clone the profile content
    const clonedProfile = modalBody.cloneNode(true);
    
    // Remove interactive elements that shouldn't be printed
    const actions = clonedProfile.querySelector('.profile-actions');
    if (actions) actions.remove();
    
    clonedProfile.querySelectorAll('.timeline-actions').forEach(el => el.remove());

    // Setup Sandbox securely off-screen
    sandbox.style.position = 'absolute';
    sandbox.style.left = '-9999px';
    sandbox.style.top = '0';
    sandbox.style.pointerEvents = 'none';
    sandbox.style.width = '740px';

    // Setup Container (Portrait A4 max)
    container.style.width = '740px';
    container.style.padding = '30px 24px';
    container.style.boxSizing = 'border-box';
    container.style.background = '#fff';
    container.style.color = '#333';
    container.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    container.classList.add('pdf-export-mode');

    const schoolName = document.getElementById('sb-school-name')?.textContent || 'NobleMinds Platform';
    const studentNameEl = modalBody.querySelector('.profile-name');
    const studentName = studentNameEl ? studentNameEl.textContent.trim() : 'Unknown';

    // Inject Official Header
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #6c63ff; padding-bottom:15px; margin-bottom:20px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div>
            <h1 style="margin:0; font-size:1.4rem; color:#1e1e2d;">Official Student Record</h1>
            <p style="margin:2px 0 0 0; font-size:0.8rem; color:#666;">${schoolName}</p>
          </div>
        </div>
        <div style="text-align:right; font-size:0.75rem; color:#666;">
          <div>Date: ${new Date().toLocaleDateString('en-IN')}</div>
        </div>
      </div>
      <div id="pdf-profile-wrapper"></div>
      <div style="margin-top: 30px; text-align: center; border-top: 1px solid #ddd; padding-top: 15px; font-size: 0.8rem; color: #666; display: flex; align-items: center; justify-content: center; gap: 8px;">
        <img src="../assets/logo.png" style="width:24px; height:24px; object-fit:contain;">
        <span>Powered by NobleMinds</span>
      </div>
    `;
    
    container.querySelector('#pdf-profile-wrapper').appendChild(clonedProfile);
    sandbox.appendChild(container);
    document.body.appendChild(sandbox);

    await new Promise(r => setTimeout(r, 200));

    const safeName = studentName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `profile_${safeName}.pdf`;

    const opt = {
      margin:       [10, 6, 10, 6], // Top, Left, Bottom, Right in mm (Shifted left via 6mm margins)
      filename:     filename,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // Force raw Blob extraction
    const pdfBlob = await html2pdf().set(opt).from(container).output('blob');
    
    // Explicit browser download execution
    const blobUrl = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    }, 500);

    nmToast('Profile PDF generated successfully!', 'success');
    btn.innerHTML = originalText;
    btn.disabled = false;

  } catch (err) {
    console.error('[PDF Export] Error:', err);
    nmToast('Failed to generate PDF.', 'error');
    btn.innerHTML = '📄 Download PDF';
    btn.disabled = false;
  } finally {
    if (sandbox && sandbox.parentNode) document.body.removeChild(sandbox);
  }
}
