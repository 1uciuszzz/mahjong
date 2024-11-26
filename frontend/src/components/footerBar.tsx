const FooterBar = () => {
  return (
    <footer className="flex justify-center">
      <small>
        &copy; {new Date().getFullYear()} made by{" "}
        <a href="https://github.com/1uciuszzz" target="_blank">
          1uciuszzz
        </a>
      </small>
    </footer>
  );
};

export default FooterBar;
