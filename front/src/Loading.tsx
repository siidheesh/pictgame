import { CircularProgress, Typography } from "@material-ui/core";
import React from "react";

const Loading = React.memo((props: any) => (
  <div className="center">
    <Typography variant="h5">{props.msg ?? "Loading..."}</Typography>
    <CircularProgress className="mt10 mb10" />
  </div>
));

export default Loading;
