import { useLoaderData, Form, useActionData } from "react-router";
import { authenticate } from "../shopify.server";
import { useState } from "react";

export const loader = async ({ request, params }) => {
  const { admin } = await authenticate.admin(request);
  const productId = `gid://shopify/Product/${params.id}`;

  const response = await admin.graphql(`#graphql
    query getProduct($id: ID!) {
      product(id: $id) {
        title
        images(first: 1) { edges { node { url altText } } }
        metafield(namespace: "custom", key: "custom_variants") { value }
      }
    }`, { variables: { id: productId } });

  const json = await response.json();
  const product = json?.data?.product;

  return {
    product,
    existingVariants: product?.metafield?.value ? JSON.parse(product.metafield.value) : null,
  };
};

export const action = async ({ request, params }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const variantData = formData.get("variantData");
  const productId = `gid://shopify/Product/${params.id}`;

  const response = await admin.graphql(`#graphql
    mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        userErrors { field message }
      }
    }`, {
      variables: {
        metafields: [{ ownerId: productId, namespace: "custom", key: "custom_variants", type: "json", value: variantData }]
      }
    });

  const json = await response.json();
  return { success: json?.data?.metafieldsSet?.userErrors?.length === 0, errors: json?.data?.metafieldsSet?.userErrors || [] };
};

export default function Details() {
  const { product, existingVariants } = useLoaderData();
  const actionData = useActionData();

  const [variants, setVariants] = useState(existingVariants || [{ variantTitle: "", operator: "plus", options: [{ label: "", value: "" }] }]);

  const updateVariant = (index, field, value) => {
    const updated = [...variants];
    updated[index][field] = value;
    setVariants(updated);
  };

  const addVariant = () => setVariants([...variants, { variantTitle: "", operator: "plus", options: [{ label: "", value: "" }] }]);
  const deleteVariant = (index) => setVariants(variants.filter((_, i) => i !== index));

  const addOption = (vIndex) => {
    const updated = [...variants];
    updated[vIndex].options.push({ label: "", value: "" });
    setVariants(updated);
  };

  const handleOptionChange = (vIndex, oIndex, field, value) => {
    const updated = [...variants];
    updated[vIndex].options[oIndex][field] = value;
    setVariants(updated);
  };

  return (
    <s-page heading="Product Custom Variant Builder">
      <Form method="POST">
        {variants.map((variant, vIndex) => (
          <s-box key={vIndex} padding="base" border="base" marginBlockEnd="medium">
            <s-grid gridTemplateColumns="1fr 1fr auto" gap="small">
              <s-text-field label="Variant Title" value={variant.variantTitle} onChange={(e) => updateVariant(vIndex, "variantTitle", e.target.value)} />
              
              <s-select label="Operator" value={variant.operator} onChange={(e) => updateVariant(vIndex, "operator", e.target.value)}>
                <s-option value="plus">Plus (+)</s-option>
                <s-option value="into">Into (*)</s-option>
              </s-select>

              <s-button tone="critical" onClick={() => deleteVariant(vIndex)}>Delete</s-button>
            </s-grid>

            {variant.options.map((option, oIndex) => (
              <s-grid key={oIndex} gridTemplateColumns="1fr 1fr auto" gap="small" paddingBlock="small">
                <s-text-field label="Label" value={option.label} onChange={(e) => handleOptionChange(vIndex, oIndex, "label", e.target.value)} />
                <s-text-field label="Value" value={option.value} onChange={(e) => handleOptionChange(vIndex, oIndex, "value", e.target.value)} />
                <s-button tone="critical" onClick={() => {
                  const updated = [...variants];
                  updated[vIndex].options = updated[vIndex].options.filter((_, i) => i !== oIndex);
                  setVariants(updated);
                }}>Delete</s-button>
              </s-grid>
            ))}
            <s-button onClick={() => addOption(vIndex)}>+ Add Option</s-button>
          </s-box>
        ))}

        <s-button onClick={addVariant}>+ Add Variant</s-button>
        <input type="hidden" name="variantData" value={JSON.stringify(variants)} />
        <s-button type="submit" variant="primary">Save All Variants</s-button>
      </Form>
    </s-page>
  );
}
