import React from "react";
import { Typography } from "@material-ui/core";
import ErrorOutlineIcon from "@material-ui/icons/ErrorOutline";

interface ErrorProps {
  msg: string;
}

const Error = React.memo((props: ErrorProps) => (
  <div className="center ma">
    <div className="center-row wrap-reverse">
      <Typography variant="h4" className="p10">
        Error
      </Typography>
      <ErrorOutlineIcon />
    </div>
    <br />
    <Typography variant="subtitle1">{props.msg}</Typography>
  </div>
));

export default Error;
