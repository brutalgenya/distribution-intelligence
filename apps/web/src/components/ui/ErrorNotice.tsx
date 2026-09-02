interface ErrorNoticeProps {
  title: string;
  message: string;
}

export const ErrorNotice = ({ title, message }: ErrorNoticeProps): JSX.Element => (
  <div className="ui-error animate-fade-in">
    <p className="font-semibold">{title}</p>
    <p className="mt-1">{message}</p>
  </div>
);
