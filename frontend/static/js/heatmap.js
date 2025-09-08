// Dynamic heatmap loader with custom calendar month calculation
document.addEventListener('DOMContentLoaded', function() {
    console.log('Heatmap loader starting...');

    let retryCount = 0;
    const maxRetries = 20; // 10 seconds max wait

    // Function to update heatmaps using navState data
    function updateHeatmapsWithData() {
        // Calculate current date
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1; // JavaScript months are 0-indexed
        const currentDay = now.getDate();

        // Update date displays with Gregorian dates
        console.log('Updating date displays and replacing heatmap placeholders...');

        // Get the actual lunar month boundaries from navState
        let currentMonthStartDate = null;
        let nextMonthStartDate = null;

        console.log('navState check:', {
            navState: !!window.navState,
            yearsData: window.navState?.yearsData,
            yearsDataLength: window.navState?.yearsData?.length
        });

        if (window.navState && window.navState.yearsData && window.navState.yearsData.length) {
            // Find current year data
            const currentYear = new Date().getFullYear();
            console.log('Looking for year:', currentYear);
            console.log('Available years:', window.navState.yearsData.map(y => y.year));

            const yearData = window.navState.yearsData.find(y => y.year === currentYear);
            console.log('Found year data:', yearData);
            console.log('All years data:', window.navState.yearsData.map(y => ({ year: y.year, monthsCount: y.months?.length || 0 })));

            if (yearData && yearData.months && yearData.months.length > 0) {
                console.log('Year months:', yearData.months.length);
                console.log('First month data:', yearData.months[0]);

                // Get current month start date - use the month that contains today's date
                const today = new Date();
                for (let i = 0; i < yearData.months.length; i++) {
                    const monthData = yearData.months[i];
                    if (monthData && monthData.start) {
                        const monthStart = new Date(monthData.start);
                        const monthEnd = (i + 1 < yearData.months.length && yearData.months[i + 1].start)
                            ? new Date(yearData.months[i + 1].start)
                            : (window.navState.yearsData.length > 1 &&
                               window.navState.yearsData[1] &&
                               window.navState.yearsData[1].months &&
                               window.navState.yearsData[1].months[0] &&
                               window.navState.yearsData[1].months[0].start
                               ? new Date(window.navState.yearsData[1].months[0].start)
                               : null);

                        if (monthStart <= today && (!monthEnd || today < monthEnd)) {
                            // This is the current month
                            currentMonthStartDate = monthStart;
                            nextMonthStartDate = monthEnd;
                            console.log('Found current month:', i + 1, 'start:', monthStart, 'end:', monthEnd);
                            console.log('Today is within this month range');
                            break;
                        }
                    }
                }

                // If we didn't find the current month, fall back to first month
                if (!currentMonthStartDate && yearData.months[0] && yearData.months[0].start) {
                    currentMonthStartDate = new Date(yearData.months[0].start);
                    if (yearData.months.length > 1 && yearData.months[1] && yearData.months[1].start) {
                        nextMonthStartDate = new Date(yearData.months[1].start);
                    }
                    console.log('Using first month as fallback:', currentMonthStartDate);
                }
            } else {
                console.log('No year data or months found for', currentYear);
            }
        } else {
            console.log('navState data not available');
        }

        // Update current month display
        const currentGregorianDate = document.getElementById('current-gregorian-date');
        if (currentGregorianDate) {
            if (currentMonthStartDate && nextMonthStartDate) {
                // Use actual lunar month boundaries
                const startDisplay = currentMonthStartDate.toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
                const endDisplay = new Date(nextMonthStartDate.getTime() - 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
                const yearDisplay = currentMonthStartDate.getFullYear();
                const finalDisplay = `${startDisplay} - ${endDisplay}, ${yearDisplay}`;
                currentGregorianDate.textContent = finalDisplay;
                console.log('Using lunar month boundaries:', finalDisplay);
            } else {
                // Fallback to approximate calculation
                const now = new Date();
                const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const currentMonthEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 29);
                const fallbackDisplay = `${currentMonthStart.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})} - ${currentMonthEnd.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}, ${now.getFullYear()}`;
                currentGregorianDate.textContent = fallbackDisplay;
                console.log('Using fallback calculation:', fallbackDisplay);
            }
        }

        // Replace heatmap placeholder with dynamic path
        let heatmapDateStr;
        if (currentMonthStartDate) {
            // Use actual lunar month start date for heatmap filename
            const year = currentMonthStartDate.getFullYear();
            const month = String(currentMonthStartDate.getMonth() + 1).padStart(2, '0');
            const day = String(currentMonthStartDate.getDate()).padStart(2, '0');
            heatmapDateStr = `${year}-${month}-${day}`;
        } else {
            // Fallback to current date
            heatmapDateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
        }

        // Current month
        const currentContainer = document.getElementById('current-heatmap');
        if (currentContainer) {
            const imagePath = `/static/img/heatmap_${heatmapDateStr}_start.png`;
            currentContainer.innerHTML = `<img src="${imagePath}" alt="Current lunar month heatmap" style="width: 100%; height: auto; border-radius: 8px;">`;
            console.log('Current month heatmap replaced with path:', imagePath);
            console.log('Container element:', currentContainer);
        } else {
            console.error('Could not find current-heatmap container element');
        }

        console.log('Heatmap replacement complete');
    }

    // Fallback function when navState data is not available
    function updateHeatmapsWithFallback() {
        console.log('Using fallback heatmap loading...');

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const currentDay = now.getDate();

        // Use current date for heatmap filename
        const heatmapDateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;

        // Update date display with fallback
        const currentGregorianDate = document.getElementById('current-gregorian-date');
        if (currentGregorianDate) {
            const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const currentMonthEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 29);
            const fallbackDisplay = `${currentMonthStart.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})} - ${currentMonthEnd.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}, ${now.getFullYear()}`;
            currentGregorianDate.textContent = fallbackDisplay;
            console.log('Using fallback date display:', fallbackDisplay);
        }

        // Load heatmap with current date
        const currentContainer = document.getElementById('current-heatmap');
        if (currentContainer) {
            const imagePath = `/static/img/heatmap_${heatmapDateStr}_start.png`;
            currentContainer.innerHTML = `<img src="${imagePath}" alt="Current lunar month heatmap" style="width: 100%; height: auto; border-radius: 8px;">`;
            console.log('Fallback heatmap loaded with path:', imagePath);
        } else {
            console.error('Could not find current-heatmap container element');
        }
    }

    // Function to wait for navState data and then update heatmaps
    function updateHeatmapsWhenReady() {
        retryCount++;

        // Check if navState and yearsData are available
        if (!window.navState || !window.navState.yearsData || !window.navState.yearsData.length) {
            console.log(`Waiting for astronomical data to load... (attempt ${retryCount}/${maxRetries})`);
            console.log('Current navState:', window.navState);

            if (retryCount >= maxRetries) {
                console.log('Max retries reached, using fallback date calculation');
                updateHeatmapsWithFallback();
                return;
            }

            // Retry in 500ms
            setTimeout(updateHeatmapsWhenReady, 500);
            return;
        }

        console.log('Astronomical data loaded, updating heatmaps...');
        console.log('navState.yearsData:', window.navState.yearsData);
        updateHeatmapsWithData();
    }

    // Start the update process
    updateHeatmapsWhenReady();
});
