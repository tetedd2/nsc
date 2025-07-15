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
  console.log("saveTransaction function called."); // Log: Function started

  // Get values from form inputs
  const type = document.getElementById('type').value;
  // Use 'description' as the 'name' field, as there's no input with id="name" in the HTML
  const description = document.getElementById('description').value.trim();
  const amount = parseFloat(document.getElementById('amount').value);
  const date = document.getElementById('date').value;

  console.log("Form data:", { type, description, amount, date }); // Log: Form data

  // Validate input data
  if (!type || !amount || amount <= 0 || !date) {
    window.showMessageBox("กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้อง", "error"); // Display error message
    console.log("Input validation failed."); // Log: Validation failed
    return; // Stop function execution
  }
  console.log("Input validation passed."); // Log: Validation passed

  // Check user authentication state using Firebase onAuthStateChanged listener
  // This ensures that we have a user (even anonymous) before attempting Firestore operations
  if (typeof auth === 'undefined' || typeof onAuthStateChanged === 'undefined') {
      console.error("Firebase Auth or onAuthStateChanged is not defined. Ensure Firebase is initialized correctly in HTML.");
      window.showMessageBox("ไม่สามารถเชื่อมต่อกับระบบยืนยันตัวตนได้ กรุณาลองใหม่ภายหลัง", "error");
      return;
  }

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      console.log("User authenticated:", user.uid); // Log: User is authenticated
      // Create a transaction object with the collected data and a server timestamp
      const transaction = {
        type,
        name: description, // Use description as the transaction name
        amount,
        date,
        createdAt: serverTimestamp() // Firestore server timestamp for creation time
      };
      console.log("Transaction object to save:", transaction); // Log: Transaction data

      try {
        console.log("Attempting to add document to Firestore..."); // Log: Attempting Firestore write
        // Check if db, collection, addDoc, appId are defined
        if (typeof db === 'undefined' || typeof collection === 'undefined' || typeof addDoc === 'undefined' || typeof appId === 'undefined') {
            console.error("Firebase Firestore components are not defined. Ensure Firebase is initialized correctly in HTML.");
            window.showMessageBox("ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่ภายหลัง", "error");
            return;
        }

        // Add the transaction document to the user's specific collection in Firestore
        // The path follows Firestore Security Rules: /artifacts/{appId}/users/{userId}/transactions
        const transactionsCollectionRef = collection(db, `artifacts/${appId}/users/${user.uid}/transactions`);
        await addDoc(transactionsCollectionRef, transaction);

        console.log("Document successfully added to Firestore!"); // Log: Firestore write success
        // Display success message and redirect to dashboard.html after confirmation
        window.showMessageBox("บันทึกรายการสำเร็จ!", "success", () => {
          console.log("Redirecting to dashboard.html..."); // Log: Redirecting
          window.location.href = "dashboard.html"; // Redirect to the dashboard page
        });
      } catch (err) {
        console.error("Error adding document to Firestore: ", err); // Log: Firestore write error
        // Display a generic error message if saving fails
        window.showMessageBox("ไม่สามารถทำรายการได้ในขณะนี้", "error");
      }
    } else {
      console.log("User not authenticated."); // Log: User not authenticated
      // If user is not authenticated, prompt them to log in
      window.showMessageBox("กรุณาเข้าสู่ระบบเพื่อบันทึกรายการ", "info", () => {
        // Optional: Redirect to a login page if one exists
        // window.location.href = "login.html";
        console.log("User not authenticated. Please implement login redirection if needed.");
      });
    }
  });
}
