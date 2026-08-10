// Looks an employee up by passport number and sends them straight into
// their timesheet, skipping the name picker on /submit-ot.
export async function submitAttendanceByPassport() {
  const passport = window.prompt('Enter your passport number to submit attendance:')?.trim();
  if (!passport) return;

  try {
    const res = await fetch(`/api/public/employees?passport=${encodeURIComponent(passport)}`);
    if (!res.ok) {
      alert('No employee found with that passport number.');
      return;
    }
    const employee = await res.json();
    window.location.assign(`/submit-ot?employee_id=${employee.id}`);
  } catch {
    alert('Could not look up that passport number. Please try again.');
  }
}
