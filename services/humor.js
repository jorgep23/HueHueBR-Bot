// services/humor.js
function randomMeme() {
  const memes = [
    "https://i.imgur.com/8gE1vTT.jpeg",
    "https://i.imgur.com/k1UDf7h.jpeg",
    "https://i.imgur.com/8zF0wE8.jpeg"
  ];
  return memes[Math.floor(Math.random() * memes.length)];
}

module.exports = { randomMeme };
