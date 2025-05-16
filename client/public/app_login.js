const form = document.querySelector('#loginForm');
const errorElem = document.querySelector('#error');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorElem.textContent = '';
  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) {
      errorElem.textContent = json.error;
      return;
    } else if (json.redirectTo) {
      location.href = json.redirectTo;
    }
  } catch (err) {
    console.error(err);
    errorElem.textContent = 'Network error caused';
  }
});
