document.addEventListener('DOMContentLoaded', () => {
    const userBadgesContainer = document.getElementById('userBadges');

    // Define all possible badges with their details
    const allBadges = [
        {
            id: 'savings-champion',
            icon: '🏦',
            name: 'นักออมตัวยง',
            description: 'ผู้เริ่มต้นสร้างวินัยทางการเงินที่ยอดเยี่ยม!',
            unlocked: false // This will be dynamic based on user data
        },
        {
            id: 'investment-master',
            icon: '💹',
            name: 'ผู้เชี่ยวชาญการลงทุน',
            description: 'นักลงทุนผู้ชาญฉลาดที่เข้าใจและสร้างผลตอบแทนจากการลงทุนได้!',
            unlocked: false
        },
        {
            id: 'financial-planner',
            icon: '📝',
            name: 'นักวางแผนการเงิน',
            description: 'นักจัดสรรงบประมาณผู้เป็นระเบียบ ที่สามารถควบคุมรายรับรายจ่ายได้อย่างอยู่หมัด!',
            unlocked: false
        },
        {
            id: 'debt-free-hero',
            icon: '💸',
            name: 'ปลอดหนี้ดีเด่น',
            description: 'ผู้ปลดแอกตัวเองจากภาระหนี้สิน สร้างอิสระทางการเงิน!',
            unlocked: false
        },
        {
            id: 'multiple-income-streams',
            icon: '🌐',
            name: 'เศรษฐีรายรับหลายทาง',
            description: 'ผู้สร้างโอกาสรายได้ที่ไม่จำกัด แค่เงินเดือนไม่พอหรอก!',
            unlocked: false
        },
        {
            id: 'young-entrepreneur',
            icon: '💡',
            name: 'ผู้ประกอบการรุ่นใหม่',
            description: 'นักบุกเบิกผู้กล้า ผู้สร้างสรรค์ธุรกิจด้วยสองมือและไอเดีย!',
            unlocked: false
        },
    ];

    // --- Simulate fetching user's unlocked badges from a backend or local storage ---
    // In a real application, you would fetch this from your server/database.
    // For demonstration, let's assume the user has unlocked 'savings-champion' and 'financial-planner'.
    const userUnlockedBadgeIds = ['savings-champion', 'financial-planner'];

    // Update the 'unlocked' status for each badge based on user data
    const badgesToDisplay = allBadges.map(badge => {
        return {
            ...badge,
            unlocked: userUnlockedBadgeIds.includes(badge.id)
        };
    });

    // --- Function to render badges ---
    function renderBadges(badges) {
        userBadgesContainer.innerHTML = ''; // Clear existing placeholders

        badges.forEach(badge => {
            const badgeElement = document.createElement('div');
            badgeElement.classList.add('badge');
            badgeElement.dataset.badgeId = badge.id; // Custom data attribute for ID

            if (badge.unlocked) {
                badgeElement.classList.add('unlocked');
                badgeElement.setAttribute('title', `${badge.name}: ${badge.description}`);
            } else {
                badgeElement.classList.add('locked');
                badgeElement.setAttribute('title', `ล็อค - ${badge.name}: ${badge.description}`);
                // You might want a different default icon for locked badges, e.g., '❓'
                // For now, we'll use the specific icon but grayscaled.
            }

            badgeElement.textContent = badge.icon;
            userBadgesContainer.appendChild(badgeElement);
        });
    }

    // Initial render
    renderBadges(badgesToDisplay);

    // --- Example: How you might unlock a badge dynamically (e.g., after an action) ---
    // This is just a conceptual example. In a real app, this would be triggered by backend logic.
    function unlockBadge(badgeId) {
        const badgeIndex = badgesToDisplay.findIndex(b => b.id === badgeId);
        if (badgeIndex !== -1 && !badgesToDisplay[badgeIndex].unlocked) {
            badgesToDisplay[badgeIndex].unlocked = true;
            renderBadges(badgesToDisplay); // Re-render to update the badge's appearance
            console.log(`Badge "${allBadges[badgeIndex].name}" unlocked!`);
            // You might want to show a notification to the user here
        }
    }

    // Simulate unlocking 'investment-master' after 5 seconds
    // setTimeout(() => {
    //     unlockBadge('investment-master');
    // }, 5000);

});