import { useEffect } from "react";

function Callback() {
  useEffect(() => {
    window.close();
  }, []);

  return <div>Connexion...</div>;
}

export default Callback;
