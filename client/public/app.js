const shiftForm = document.getElementById('shiftForm');
const errorElem = document.getElementById('error');

const startTime = document.getElementById('startTime');
const endTime = document.getElementById('endTime');
const start_tbd = document.getElementById('start_tbd');
const end_tbd = document.getElementById('end_tbd');
const username = document.getElementById('username');
const submitDiv = document.getElementById('submitDiv');
const submitButton = document.getElementById('submitButton');

const data = document.getElementById('date');
const comment = document.getElementById('comment');

let editingDate = null;
let editingRow = null;
let currentUser = null;

(async () => {
  try {
    const resUser = await fetch('/api/user');
    const userData = await resUser.json();
    if (resUser && userData) {
      username.textContent = `ログイン中のユーザー：${userData.user}`;
      currentUser = userData.user;
    }
    submitButton.textContent = '送信';
    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.textContent = 'キャンセル';
    cancelButton.style.display = 'none';
    cancelButton.addEventListener('click', () => {
      editingDate = null;
      editingRow.style.backgroundColor = '';
      submitButton.textContent = '送信';
      cancelButton.style.display = 'none';

      document.querySelector('[name="date"]').value = null;
      document.querySelector('[name="start"]').value = null;
      document.querySelector('[name="end"]').value = null;
      startTime.disabled = false;
      endTime.disabled = false;
      start_tbd.checked = false;
      end_tbd.checked = false;
      document.querySelector('[name="comment"]').value = null;
    });
    submitDiv.append(cancelButton);

    const postBody = document.getElementById('postBody');
    const resPosts = await fetch('/api/posts');
    const posts = await resPosts.json();
    posts.forEach((post) => {
      const row = document.createElement('tr');
      ['username', 'date', 'start', 'end', 'comment'].forEach((key) => {
        const cell = document.createElement('td');
        if (key === 'comment') cell.className = 'comment';
        cell.textContent = post[key];
        row.appendChild(cell);
      });
      const buttonCell = document.createElement('td');
      //編集
      const editButton = document.createElement('button');
      editButton.textContent = '編集';
      editButton.addEventListener('click', () => {
        document.querySelectorAll('#postBody tr').forEach((tr) => {
          tr.style.backgroundColor = '';
        });
        row.style.backgroundColor = 'red';
        editingRow = row;

        editingDate = post.date;
        submitButton.textContent = '修正';
        cancelButton.style.display = 'inline';

        document.querySelector('[name="date"]').value = post.date;
        if (post.start == '99:99') {
          start_tbd.checked = true;
          startTime.disabled = true;
          startTime.value = '';
        } else {
          start_tbd.checked = false;
          startTime.disabled = false;
          startTime.value = post.start;
        }
        if (post.end == '99:99') {
          end_tbd.checked = true;
          endTime.disabled = true;
          startTime.value = '';
        } else {
          end_tbd.checked = false;
          endTime.disabled = false;
          endTime.value = post.end;
        }
        document.querySelector('[name="comment"]').value = post.comment;
      });

      //削除
      const delButton = document.createElement('button');
      delButton.textContent = '削除';
      delButton.addEventListener('click', async () => {
        const res = await fetch('/api/posts/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          //自分のものでなくても削除可。
          body: JSON.stringify({ user: post.username, date: post.date }),
        });
        location.href = '/';
      });
      if (post.username === currentUser) {
        buttonCell.appendChild(editButton);
        buttonCell.appendChild(delButton);
      }
      row.appendChild(buttonCell);
      postBody.appendChild(row);
    });
  } catch (err) {
    errorElem.textContent = 'Initialization Failed';
    console.error(err);
  }
})();
//イベントリスナー
start_tbd.addEventListener('change', () => {
  if (start_tbd.checked) {
    startTime.disabled = true;
    startTime.value = '';
  } else startTime.disabled = false;
});
end_tbd.addEventListener('change', () => {
  if (end_tbd.checked) {
    endTime.disabled = true;
    endTime.value = '';
  } else endTime.disabled = false;
});

shiftForm.addEventListener('submit', async (e) => {
  //現在のURLにフォーム送信されるのを防ぐ
  e.preventDefault();
  errorElem.textContent = '';
  const formData = new FormData(shiftForm);

  if (editingDate) formData.set('original_date', editingDate);
  if (start_tbd.checked) formData.set('start', '99:99');
  if (end_tbd.checked) formData.set('end', '99:99');

  const data = Object.fromEntries(formData.entries());
  console.log(JSON.stringify(data));

  try {
    const res = await fetch('/api/posts', {
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
    errorElem.textContent = 'Network error caused';
    console.error(err);
  }
  editingDate = null;
  editingStatus = null;
});
