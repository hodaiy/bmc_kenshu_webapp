const postTable = document.querySelector('#postTable tbody');
const res = await fetch('/api/posts');
const posts = await res.json();
posts.forEach((post) => {
  const row = document.createElement('tr');
  ['username', 'date', 'start', 'end', 'comment'].forEach((key) => {
    const cell = document.createElement('td');
    // 日付の整形（ISO文字列からYYYY-MM-DD）
    if (key === 'date') {
      const dateObj = new Date(post[key]);
      cell.textContent = dateObj.toLocaleDateString('ja-JP');
    } else {
      cell.textContent = post[key];
    }
    row.appendChild(cell);
  });

  const editBtn = document.createElement('button');
  editBtn.textContent = '編集';
  editBtn.addEventListener('click', () => {
    // 投稿内容をフォームにセット
    const yyyyMMdd = formatLocalDate(post.date);
    document.querySelector('[name="date"]').value = yyyyMMdd;
    document.querySelector('[name="start"]').value = post.start;
    document.querySelector('[name="end"]').value = post.end;
    document.querySelector('[name="comment"]').value = post.comment;
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = '削除';
  deleteBtn.addEventListener('click', async () => {
    if (!confirm('この投稿を削除しますか？')) return;
    const yyyyMMdd = formatLocalDate(post.date);
    const res = await fetch('/api/posts/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: post.username, date: yyyyMMdd }),
    });
    location.href = '/';
  });

  row.appendChild(editBtn);
  row.appendChild(deleteBtn);
  postTable.appendChild(row);
});

function formatLocalDate(dateString) {
  const d = new Date(dateString);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
