import { authClient } from "~auth/auth-client"

function IndexPopup() {
  const { data, isPending, error } = authClient.useSession()
  if (isPending) {
    return <>Loading...</>
  }
  if (error) {
    return <>Error: {error.message}</>
  }
  if (data) {
    return <>Signed in as {data.user.name}</>
  }
}

export default IndexPopup
