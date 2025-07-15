// Set the current date in the date input field when the DOM content is loaded
window.addEventListener('DOMContentLoaded', function () {
  const dateInput = document.getElementById('date');
  if (dateInput) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
    const dd = String(today.getDate()).padStart(2, '0');
    dateInput.value = `${yyyy}-${mm}-${dd}`;
  }
});

// The showMessageBox function is now defined in add-transaction.html within the module script
// to ensure it's available globally before other scripts try to call it.

// Function to save transaction data to Firestore
async function saveTransaction(event) {
  event.preventDefault(); // Prevent default form submission behavior

  // Get values from form inputs
  const type = document.getElementById('type').value;
  // Use 'description' as the 'name' field, as there's no input with id="name" in the HTML
  const description = document.getElementById('description').value.trim();
  const amount = parseFloat(document.getElementById('amount').value);
  const date = document.getElementById('date').value;

  // Validate input data
  if (!type || !amount || amount <= 0 || !date) {
    window.showMessageBox("กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้อง", "error"); // Display error message
    return; // Stop function execution
  }

  // Check user authentication state using Firebase onAuthStateChanged listener
  // This ensures that we have a user (even anonymous) before attempting Firestore operations
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Create a transaction object with the collected data and a server timestamp
      const transaction = {
        type,
        name: description, // Use description as the transaction name
        amount,
        date,
        createdAt: serverTimestamp() // Firestore server timestamp for creation time
      };

      try {
        // Add the transaction document to the user's specific collection in Firestore
        // The path follows Firestore Security Rules: /artifacts/{appId}/users/{userId}/transactions
        const transactionsCollectionRef = collection(db, `artifacts/${appId}/users/${user.uid}/transactions`);
        await addDoc(transactionsCollectionRef, transaction);

        // Display success message and redirect to dashboard.html after confirmation
        window.showMessageBox("บันทึกรายการสำเร็จ!", "success", () => {
          window.location.href = "dashboard.html"; // Redirect to the dashboard page
        });
      } catch (err) {
        console.error("Error adding document: ", err);
        // Display a generic error message if saving fails
        window.showMessageBox("ไม่สามารถทำรายการได้ในขณะนี้", "error");
      }
    } else {
      // If user is not authenticated, prompt them to log in
      window.showMessageBox("กรุณาเข้าสู่ระบบเพื่อบันทึกรายการ", "info", () => {
        // Optional: Redirect to a login page if one exists
        // window.location.href = "login.html";
        console.log("User not authenticated. Please implement login redirection if needed.");
      });
    }
  });
}
