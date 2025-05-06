const postTable = document.querySelector('#postTable tbody');
const res = await fetch('/api/posts');
const posts = await res.json();
posts.forEach((post) => {
  const row = document.createElement('tr');
  ['user', 'date', 'start', 'end', 'comment'].forEach((key) => {
    const cell = document.createElement('td');
    cell.textContent = post[key];
    row.appendChild(cell);
  });
  postTable.appendChild(row);
});
