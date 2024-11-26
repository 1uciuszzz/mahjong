type ErrorMsgProps = {
  msg?: string;
};

const ErrorMsg = ({ msg }: ErrorMsgProps) => {
  return (
    <div className="w-full h-screen flex justify-center items-center">
      <p className="text-destructive">{msg || `出错了`}</p>
    </div>
  );
};

export default ErrorMsg;
