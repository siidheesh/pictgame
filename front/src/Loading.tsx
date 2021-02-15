import { CircularProgress, Typography } from "@material-ui/core";
import React from "react";

const Loading = React.memo((props: any) => (
  <div
    style={{
      margin: "auto",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    }}
  >
    <Typography variant="h5">{props.msg ?? "Loading..."}</Typography>
    <CircularProgress style={{ margin: "10px 0 10px 0" }} />
  </div>
));

export default Loading;
