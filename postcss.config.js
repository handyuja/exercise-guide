// postcss.config.js
export default {
  plugins: {
    "@tailwindcss/postcss": {},
    autoprefixer: {}, // 이미 설치되어 있으면 유지해도 OK (없어도 동작)
  },
}
